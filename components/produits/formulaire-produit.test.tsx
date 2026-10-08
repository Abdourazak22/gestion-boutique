import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";
import { FormulaireProduit } from "./formulaire-produit";
import type { Produit } from "@/lib/types";

vi.mock("@/lib/produits", () => ({
  creerProduit: vi.fn(),
  modifierProduit: vi.fn(),
  supprimerProduit: vi.fn(),
}));
vi.mock("@/lib/notifier", () => ({
  notifier: {
    erreur: vi.fn(),
    succes: vi.fn(),
    pendant: vi.fn((promesse: Promise<unknown>) => promesse),
    apresRedirection: vi.fn(),
  },
}));

const { creerProduit, modifierProduit, supprimerProduit } =
  await import("@/lib/produits");

const PRODUIT: Produit = {
  id: 7,
  nom: "Riz paarfumé de 25kg",
  description: "Sac importé",
  prixAchat: 14500,
  prixVente: 17500,
  unite: "SACHET",
  quantiteStock: 18,
  seuilAlerte: 5,
  enAlerteStock: false,
};

/** Le serveur refuse un champ : son message doit s'afficher sous l'input. */
const refus400 = (champs: Record<string, string>) => {
  const erreur = new AxiosError("Requête invalide");
  erreur.response = {
    status: 400,
    data: { statut: 400, message: "Requête invalide", champs },
    statusText: "Bad Request",
    headers: {},
    config: { headers: {} } as never,
  };
  return erreur;
};

const enregistrer = async (nom: RegExp) =>
  userEvent.click(screen.getByRole("button", { name: nom }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(modifierProduit).mockResolvedValue(PRODUIT);
  vi.mocked(creerProduit).mockResolvedValue(PRODUIT);
  vi.mocked(supprimerProduit).mockResolvedValue(undefined);
});

describe("modification d'un produit", () => {
  const monter = () =>
    render(
      <FormulaireProduit
        produit={PRODUIT}
        onFermer={vi.fn()}
        onEnregistre={vi.fn()}
      />,
    );

  it("part des valeurs du produit", () => {
    monter();

    expect(screen.getByLabelText(/nom du produit/i)).toHaveValue("Riz paarfumé de 25kg");
    expect(screen.getByLabelText(/description/i)).toHaveValue("Sac importé");
    expect(screen.getByLabelText(/prix d’achat/i)).toHaveValue(14500);
    expect(screen.getByLabelText(/prix de vente/i)).toHaveValue(17500);
    expect(screen.getByLabelText(/unité/i)).toHaveValue("SACHET");
    expect(screen.getByLabelText(/seuil d’alerte/i)).toHaveValue(5);
  });

  /**
   * Le champ existait, et c'était le défaut : il renvoyait la quantité lue à
   * l'ouverture, écrasant toute vente enregistrée depuis. Le stock se corrige
   * par un inventaire, qui en garde la trace et le motif.
   */
  it("ne propose aucun champ de stock, mais rappelle le stock actuel", () => {
    monter();

    expect(screen.queryByLabelText(/stock initial/i)).not.toBeInTheDocument();
    expect(screen.getByText(/stock actuel : 18 sachet/i)).toBeInTheDocument();
    expect(screen.getByText(/par un inventaire/i)).toBeInTheDocument();
  });

  it("envoie les champs modifiés sans la quantité en stock", async () => {
    monter();

    const nom = screen.getByLabelText(/nom du produit/i);
    await userEvent.clear(nom);
    await userEvent.type(nom, "Riz parfumé 25 kg");
    await enregistrer(/enregistrer les modifications/i);

    await waitFor(() =>
      expect(modifierProduit).toHaveBeenCalledWith(7, {
        nom: "Riz parfumé 25 kg",
        description: "Sac importé",
        prixAchat: 14500,
        prixVente: 17500,
        unite: "SACHET",
        seuilAlerte: 5,
      }),
    );
  });

  it("refuse un prix de vente sous le prix d’achat sans appeler le serveur", async () => {
    monter();

    const vente = screen.getByLabelText(/prix de vente/i);
    await userEvent.clear(vente);
    await userEvent.type(vente, "9000");
    await enregistrer(/enregistrer les modifications/i);

    expect(
      await screen.findByText(/le prix de vente ne peut être inférieur au prix d’achat/i),
    ).toBeInTheDocument();
    expect(modifierProduit).not.toHaveBeenCalled();
  });

  it("affiche l’erreur du serveur sous le champ visé", async () => {
    vi.mocked(modifierProduit).mockRejectedValue(
      refus400({ nom: "Un autre produit porte déjà ce nom." }),
    );
    monter();

    await enregistrer(/enregistrer les modifications/i);

    expect(
      await screen.findByText(/un autre produit porte déjà ce nom/i),
    ).toBeInTheDocument();
  });

  it("garde la saisie de l’utilisateur après un refus", async () => {
    vi.mocked(modifierProduit).mockRejectedValue(refus400({ nom: "Nom déjà pris." }));
    monter();

    const nom = screen.getByLabelText(/nom du produit/i);
    await userEvent.clear(nom);
    await userEvent.type(nom, "Spagetti");
    await enregistrer(/enregistrer les modifications/i);

    await screen.findByText(/nom déjà pris/i);
    // Reperdre son travail à chaque refus serait pire que l'erreur elle-même.
    expect(screen.getByLabelText(/nom du produit/i)).toHaveValue("Spagetti");
  });
});

describe("création d'un produit", () => {
  const monter = () =>
    render(<FormulaireProduit onFermer={vi.fn()} onEnregistre={vi.fn()} />);

  it("demande le stock initial, lui", async () => {
    monter();
    expect(screen.getByLabelText(/stock initial/i)).toBeInTheDocument();
    expect(screen.queryByText(/stock actuel/i)).not.toBeInTheDocument();
  });

  it("transmet le stock initial à la création", async () => {
    monter();

    await userEvent.type(screen.getByLabelText(/nom du produit/i), "Sucre 1 kg");
    await userEvent.type(screen.getByLabelText(/prix d’achat/i), "800");
    await userEvent.type(screen.getByLabelText(/prix de vente/i), "1000");
    await userEvent.clear(screen.getByLabelText(/stock initial/i));
    await userEvent.type(screen.getByLabelText(/stock initial/i), "24");
    await enregistrer(/ajouter le produit/i);

    await waitFor(() =>
      expect(creerProduit).toHaveBeenCalledWith({
        nom: "Sucre 1 kg",
        description: null,
        prixAchat: 800,
        prixVente: 1000,
        unite: "PIECE",
        quantiteStock: 24,
        seuilAlerte: 0,
      }),
    );
  });
});

describe("retrait d'un produit du catalogue", () => {
  const monter = (surcharges: Partial<Produit> = {}, onEnregistre = vi.fn()) => {
    const onFermer = vi.fn();
    render(
      <FormulaireProduit
        produit={{ ...PRODUIT, ...surcharges }}
        onFermer={onFermer}
        onEnregistre={onEnregistre}
      />,
    );
    return { onFermer, onEnregistre };
  };

  const demander = () =>
    userEvent.click(screen.getByRole("button", { name: /supprimer du catalogue/i }));

  it("n'est pas proposé pendant la création", () => {
    render(<FormulaireProduit onFermer={vi.fn()} onEnregistre={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: /supprimer du catalogue/i }),
    ).not.toBeInTheDocument();
  });

  /**
   * Une suppression ne doit pas partir au premier clic, et la confirmation
   * doit dire ce qu'elle emporte plutôt que demander « êtes-vous sûr ».
   */
  it("demande confirmation en annonçant les conséquences", async () => {
    monter();
    await demander();

    expect(await screen.findByText(/retirer .*Riz paarfumé.* du catalogue/i)).toBeInTheDocument();
    expect(screen.getByText(/reste rattaché aux ventes et livraisons/i)).toBeInTheDocument();
    expect(screen.getByText(/18 sachet en stock sortiront de la valorisation/i)).toBeInTheDocument();
    expect(screen.getByText(/le remettra au catalogue/i)).toBeInTheDocument();
    expect(supprimerProduit).not.toHaveBeenCalled();
  });

  it("ne parle pas de valorisation quand le stock est vide", async () => {
    monter({ quantiteStock: 0 });
    await demander();

    await screen.findByText(/retirer .*Riz paarfumé.* du catalogue/i);
    expect(screen.queryByText(/sortiront de la valorisation/i)).not.toBeInTheDocument();
  });

  it("revient en arrière si l'on renonce", async () => {
    monter();
    await demander();
    await userEvent.click(screen.getByRole("button", { name: /renoncer/i }));

    expect(
      await screen.findByRole("button", { name: /enregistrer les modifications/i }),
    ).toBeInTheDocument();
    expect(supprimerProduit).not.toHaveBeenCalled();
  });

  it("retire le produit une fois confirmé", async () => {
    const { onFermer, onEnregistre } = monter();
    await demander();
    await userEvent.click(
      screen.getByRole("button", { name: /oui, retirer du catalogue/i }),
    );

    await waitFor(() => expect(supprimerProduit).toHaveBeenCalledWith(7));
    expect(onEnregistre).toHaveBeenCalled();
    expect(onFermer).toHaveBeenCalled();
  });
});
