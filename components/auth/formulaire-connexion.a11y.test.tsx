import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormulaireConnexion } from "./formulaire-connexion";
import { attendreAucuneInfraction } from "@/lib/aide-accessibilite";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/notifier", () => ({
  notifier: { erreur: vi.fn(), succes: vi.fn(), pendant: vi.fn(), apresRedirection: vi.fn() },
}));

describe("accessibilité du formulaire de connexion", () => {
  it("ne présente aucune infraction détectable par axe", async () => {
    const { container } = render(<FormulaireConnexion />);
    await attendreAucuneInfraction(container);
  });

  it("étiquette chaque champ, sans dépendre d'un indice visuel", () => {
    render(<FormulaireConnexion />);

    expect(screen.getByLabelText(/nom d’utilisateur/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/se souvenir de moi/i)).toBeInTheDocument();
  });

  it("nomme le bouton de soumission, dont l'icône seule ne dirait rien", () => {
    render(<FormulaireConnexion />);
    expect(screen.getByRole("button", { name: /se connecter/i })).toBeInTheDocument();
  });

  it("marque les champs obligatoires pour les technologies d'assistance", () => {
    render(<FormulaireConnexion />);
    expect(screen.getByLabelText(/nom d’utilisateur/i)).toBeRequired();
    expect(screen.getByLabelText(/mot de passe/i)).toBeRequired();
  });
});
