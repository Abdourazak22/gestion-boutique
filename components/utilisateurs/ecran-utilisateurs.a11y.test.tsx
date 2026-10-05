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
