import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TableVentes } from "./table-ventes";
import { achatDeTest } from "@/lib/aide-test";
import type { Role } from "@/lib/types";

const role = { courant: "GERANT" as Role };

vi.mock("@/lib/achats", () => ({
  listerAchats: vi.fn(),
  exporterVentes: vi.fn(),
  ouvrirTicket: vi.fn(),
  annulerAchat: vi.fn(),
}));
vi.mock("@/components/auth/session", () => ({
  useSession: () => ({
    utilisateur: {
      id: 1, nom: "Ouattara", prenom: "Gerant", matricule: "MAT-0001",
      sexe: "MASCULIN", dateNaissance: "1985-01-15",
      identifiant: "gerant", role: role.courant, actif: true,
    },
    deconnecter: vi.fn(),
    deconnexionEnCours: false,
  }),
}));
vi.mock("@/lib/notifier", () => ({
  notifier: {
    erreur: vi.fn(),
    succes: vi.fn(),
    pendant: vi.fn((promesse: Promise<unknown>) => promesse),
    apresRedirection: vi.fn(),
  },
}));

const { listerAchats, annulerAchat, exporterVentes } =
  await import("@/lib/achats");

const VENTE = achatDeTest({
  lignes: [
    { produitId: 1, nomProduit: "Riz", quantite: 3, prixUnitaire: 5500, montantLigne: 16500 },
  ],
});

const page = (achats = [VENTE]) => ({
  content: achats,
  page: { size: 20, number: 0, totalElements: achats.length, totalPages: 1 },
});

beforeEach(() => {
  vi.clearAllMocks();
  role.courant = "GERANT";
  vi.mocked(listerAchats).mockResolvedValue(page());
});

const ouvrirLeTicket = async () =>
  userEvent.click(
    await screen.findByRole("button", { name: /ouvrir le ticket ACH-20261005-0001/i }),
  );

describe("statut d'une vente dans l'historique", () => {
  it("marque une vente payée", async () => {
    render(<TableVentes />);
    expect(await screen.findByText("Payée")).toBeInTheDocument();
  });

  it("marque une vente annulée et barre son montant", async () => {
    vi.mocked(listerAchats).mockResolvedValue(
      page([achatDeTest({ statut: "ANNULE", motifAnnulation: "RETOUR_CLIENT" })]),
    );

    render(<TableVentes />);

    expect(await screen.findByText("Annulée")).toBeInTheDocument();
    // Le montant ne doit pas se lire comme un encaissement.
    // Espace ordinaire et non fine : Testing Library normalise les blancs
    // avant de comparer, et l'espace fine insécable d'`Intl` y passe.
    expect(screen.getByText(/18 500 FCFA/)).toHaveClass("line-through");
  });
});

describe("accès à l'annulation", () => {
  /**
   * Laisser un vendeur annuler ses propres encaissements ouvre la porte au
   * détournement. Le serveur refuse en 403 ; l'interface n'offre même pas
   * l'action.
   */
  it("n'offre pas l'action à un vendeur", async () => {
    role.courant = "VENDEUR";
    render(<TableVentes />);
    await ouvrirLeTicket();

    expect(
      screen.queryByRole("button", { name: /annuler cette vente/i }),
    ).not.toBeInTheDocument();
  });

  it("offre l'action au gérant sur une vente payée", async () => {
    render(<TableVentes />);
    await ouvrirLeTicket();

    expect(
      screen.getByRole("button", { name: /annuler cette vente/i }),
    ).toBeInTheDocument();
  });

  it("ne propose pas de réannuler une vente déjà annulée", async () => {
    vi.mocked(listerAchats).mockResolvedValue(page([achatDeTest({ statut: "ANNULE" })]));

    render(<TableVentes />);
    await ouvrirLeTicket();

    expect(
      screen.queryByRole("button", { name: /annuler cette vente/i }),
    ).not.toBeInTheDocument();
  });
});

describe("formulaire d'annulation", () => {
  const ouvrirLeFormulaire = async () => {
    render(<TableVentes />);
    await ouvrirLeTicket();
    await userEvent.click(screen.getByRole("button", { name: /annuler cette vente/i }));
    return screen.findByRole("dialog");
  };

  it("propose les quatre motifs, erreur de saisie par défaut", async () => {
    await ouvrirLeFormulaire();

    expect(screen.getByLabelText(/motif/i)).toHaveValue("ERREUR_SAISIE");
    for (const m of ["Erreur de saisie", "Retour client", "Produit défectueux", "Autre"]) {
      expect(screen.getByRole("option", { name: m })).toBeInTheDocument();
    }
  });

  /**
   * Une erreur de saisie n'a jamais sorti la marchandise ; un produit
   * défectueux ne doit pas revenir en rayon comme vendable.
   */
  it("décoche le retour en stock quand le produit est défectueux", async () => {
    await ouvrirLeFormulaire();
    const retour = screen.getByLabelText(/remettre.*en stock/i);
    expect(retour).toBeChecked();

    await userEvent.selectOptions(screen.getByLabelText(/motif/i), "PRODUIT_DEFECTUEUX");

    expect(retour).not.toBeChecked();
    expect(screen.getByText(/la marchandise est perdue/i)).toBeInTheDocument();
  });

  it("laisse le gérant décider malgré la suggestion du motif", async () => {
    await ouvrirLeFormulaire();
    await userEvent.selectOptions(screen.getByLabelText(/motif/i), "PRODUIT_DEFECTUEUX");

    const retour = screen.getByLabelText(/remettre.*en stock/i);
    await userEvent.click(retour);

    expect(retour).toBeChecked();
  });

  it("transmet motif, retour en stock et commentaire", async () => {
    vi.mocked(annulerAchat).mockResolvedValue(achatDeTest({ statut: "ANNULE" }));
    await ouvrirLeFormulaire();

    await userEvent.selectOptions(screen.getByLabelText(/motif/i), "RETOUR_CLIENT");
    await userEvent.type(screen.getByLabelText(/commentaire/i), "le client a changé d'avis");
    await userEvent.click(screen.getByRole("button", { name: /^annuler la vente$/i }));

    await waitFor(() =>
      expect(vi.mocked(annulerAchat)).toHaveBeenCalledWith(1, {
        motif: "RETOUR_CLIENT",
        commentaire: "le client a changé d'avis",
        retourEnStock: true,
      }),
    );
  });

  it("omet un commentaire vide plutôt que d'envoyer une chaîne nulle", async () => {
    vi.mocked(annulerAchat).mockResolvedValue(achatDeTest({ statut: "ANNULE" }));
    await ouvrirLeFormulaire();

    await userEvent.click(screen.getByRole("button", { name: /^annuler la vente$/i }));

    await waitFor(() =>
      expect(vi.mocked(annulerAchat)).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ commentaire: undefined }),
      ),
    );
  });

  it("recharge l'historique après une annulation réussie", async () => {
    vi.mocked(annulerAchat).mockResolvedValue(achatDeTest({ statut: "ANNULE" }));
    await ouvrirLeFormulaire();
    const appelsAvant = vi.mocked(listerAchats).mock.calls.length;

    await userEvent.click(screen.getByRole("button", { name: /^annuler la vente$/i }));

    await waitFor(() =>
      expect(vi.mocked(listerAchats).mock.calls.length).toBeGreaterThan(appelsAvant),
    );
  });
});

describe("export comptable depuis l'historique", () => {
  /**
   * Le fichier porte la marge de chaque vente, que le serveur réserve au
   * gérant : proposer le bouton à un vendeur ne mènerait qu'à un 403.
   */
  it("n'est pas proposé à un vendeur", async () => {
    role.courant = "VENDEUR";

    render(<TableVentes />);
    await screen.findByText("ACH-20261005-0001");

    expect(
      screen.queryByRole("button", { name: /exporter en csv/i }),
    ).not.toBeInTheDocument();
  });

  it("exporte sans bornes quand aucune date n'est saisie", async () => {
    vi.mocked(exporterVentes).mockResolvedValue(undefined);

    render(<TableVentes />);
    await screen.findByText("ACH-20261005-0001");
    await userEvent.click(screen.getByRole("button", { name: /exporter en csv/i }));

    await waitFor(() =>
      expect(exporterVentes).toHaveBeenCalledWith(undefined, undefined),
    );
  });

  /**
   * Le bouton doit faire ce que les deux champs de dates annoncent : exporter
   * la période affichée, et non tout l'historique.
   */
  it("exporte la période affichée", async () => {
    vi.mocked(exporterVentes).mockResolvedValue(undefined);

    render(<TableVentes />);
    await screen.findByText("ACH-20261005-0001");

    await userEvent.type(screen.getByLabelText("Du"), "2026-10-01");
    await userEvent.type(screen.getByLabelText("Au"), "2026-10-08");
    await userEvent.click(screen.getByRole("button", { name: /exporter en csv/i }));

    await waitFor(() =>
      expect(exporterVentes).toHaveBeenCalledWith("2026-10-01", "2026-10-08"),
    );
  });
});
