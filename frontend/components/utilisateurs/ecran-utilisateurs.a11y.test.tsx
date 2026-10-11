import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EcranUtilisateurs } from "./ecran-utilisateurs";
import { attendreAucuneInfraction } from "@/lib/aide-accessibilite";
import type { Utilisateur } from "@/lib/types";

const GERANT: Utilisateur = {
  id: 1, nom: "Ouattara", prenom: "Gerant", matricule: "MAT-0001",
  sexe: "MASCULIN", dateNaissance: "1985-01-15",
  identifiant: "gerant", role: "GERANT", actif: true,
};
const VENDEUSE: Utilisateur = {
  id: 2, nom: "Diallo", prenom: "Fatou", matricule: "MAT-0051",
  sexe: "FEMININ", dateNaissance: "1999-07-25",
  identifiant: "fdiallo", role: "VENDEUR", actif: false,
};

vi.mock("@/components/auth/session", () => ({
  useSession: () => ({ utilisateur: GERANT, deconnecter: vi.fn(), deconnexionEnCours: false }),
}));
vi.mock("@/lib/utilisateurs", () => ({
  listerUtilisateurs: vi.fn(),
  changerStatutUtilisateur: vi.fn(),
  deconnecterUtilisateur: vi.fn(),
  creerUtilisateur: vi.fn(),
  modifierUtilisateur: vi.fn(),
  reinitialiserMotDePasse: vi.fn(),
}));
vi.mock("@/lib/notifier", () => ({
  notifier: { erreur: vi.fn(), succes: vi.fn(), pendant: vi.fn(), apresRedirection: vi.fn() },
}));

const { listerUtilisateurs } = await import("@/lib/utilisateurs");

beforeEach(() => {
  vi.mocked(listerUtilisateurs).mockResolvedValue({
    content: [GERANT, VENDEUSE],
    page: { size: 20, number: 0, totalElements: 2, totalPages: 1 },
  });
});

describe("accessibilité de l'écran Utilisateurs", () => {
  it("ne présente aucune infraction, tableau chargé", async () => {
    const { container } = render(<EcranUtilisateurs />);
    await screen.findByText(/Gerant Ouattara/);

    await attendreAucuneInfraction(container);
  });

  it("ne présente aucune infraction, modale de mot de passe ouverte", async () => {
    const { container } = render(<EcranUtilisateurs />);
    await screen.findByText(/Fatou Diallo/);

    await userEvent.click(
      screen.getByRole("button", {
        name: /réinitialiser le mot de passe de Fatou Diallo/i,
      }),
    );
    await screen.findByRole("dialog");

    await attendreAucuneInfraction(container);
  });

  /**
   * Chaque ligne du tableau porte les mêmes libellés d'action. Sans nom
   * accessible, un lecteur d'écran n'annonce qu'une suite de « Modifier »
   * indiscernables hors de leur contexte visuel.
   */
  it("nomme chaque action par la personne qu'elle vise", async () => {
    render(<EcranUtilisateurs />);
    await screen.findByText(/Fatou Diallo/);

    expect(
      screen.getByRole("button", { name: /modifier Fatou Diallo/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /réactiver le compte de Fatou Diallo/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /déconnecter Gerant Ouattara/i }),
    ).toBeInTheDocument();
  });

  /**
   * Le serveur refuse qu'un gérant réinitialise son propre mot de passe : le
   * sien se change dans ses paramètres, où l'actuel est exigé. L'interface ne
   * doit donc pas proposer l'action qui finirait en 409.
   */
  it("n'offre pas la réinitialisation sur son propre compte", async () => {
    render(<EcranUtilisateurs />);
    await screen.findByText(/Gerant Ouattara/);

    expect(
      screen.queryByRole("button", {
        name: /réinitialiser le mot de passe de Gerant Ouattara/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /réinitialiser le mot de passe de Fatou Diallo/i,
      }),
    ).toBeInTheDocument();
  });

  it("ne présente aucune infraction, modale de création ouverte", async () => {
    const { container } = render(<EcranUtilisateurs />);
    await screen.findByText(/Gerant Ouattara/);

    await userEvent.click(screen.getByRole("button", { name: /ajouter un utilisateur/i }));
    await screen.findByRole("dialog");

    await attendreAucuneInfraction(container);
  });

  /** Un tableau sans légende laisse un lecteur d'écran sans contexte. */
  it("donne une légende au tableau", async () => {
    render(<EcranUtilisateurs />);
    await screen.findByText(/Gerant Ouattara/);

    expect(screen.getByRole("table")).toHaveAccessibleName(/matricule.*sexe.*rôle/i);
  });

  it("associe chaque colonne à son en-tête", async () => {
    render(<EcranUtilisateurs />);
    await screen.findByText(/Gerant Ouattara/);

    const entetes = screen.getAllByRole("columnheader");
    expect(entetes.length).toBeGreaterThan(5);
    for (const e of entetes) expect(e).toHaveAttribute("scope", "col");
  });

  it("double l'état du compte d'un libellé lisible", async () => {
    render(<EcranUtilisateurs />);
    await screen.findByText(/Gerant Ouattara/);

    expect(screen.getByText("Actif")).toBeInTheDocument();
    expect(screen.getByText("Suspendu")).toBeInTheDocument();
  });
});
