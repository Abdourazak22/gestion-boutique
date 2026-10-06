import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormulaireConnexion } from "./formulaire-connexion";
import type { Utilisateur } from "@/lib/types";

const routeur = { replace: vi.fn(), push: vi.fn() };

vi.mock("next/navigation", () => ({ useRouter: () => routeur }));
vi.mock("@/lib/auth", () => ({ seConnecter: vi.fn() }));
vi.mock("@/lib/notifier", () => ({
  notifier: {
    erreur: vi.fn(),
    succes: vi.fn(),
    pendant: vi.fn(),
    apresRedirection: vi.fn(),
  },
}));

const { seConnecter } = await import("@/lib/auth");

const GERANT: Utilisateur = {
  id: 1, nom: "Ouattara", prenom: "Gerant", matricule: "MAT-0001",
  sexe: "MASCULIN", dateNaissance: "1985-01-15",
  identifiant: "gerant", role: "GERANT", actif: true,
};

const saisirEtEnvoyer = async () => {
  await userEvent.type(screen.getByLabelText(/nom d’utilisateur/i), "gerant");
  await userEvent.type(screen.getByLabelText(/mot de passe/i), "gerant123");
  await userEvent.click(screen.getByRole("button", { name: /se connecter/i }));
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(seConnecter).mockResolvedValue(GERANT);
});

describe("persistance de la session", () => {
  /**
   * Le poste du comptoir est partagé. Laisser une session ouverte doit être un
   * geste volontaire, sans quoi le vendeur qui rouvre l'application hérite des
   * droits du gérant : annuler une vente, ajuster un stock, lire les marges.
   */
  it("ne propose pas de rester connecté par défaut", () => {
    render(<FormulaireConnexion />);

    expect(
      screen.getByRole("checkbox", { name: /rester connecté sur cet appareil/i }),
    ).not.toBeChecked();
  });

  it("n'enregistre pas la session de façon persistante par défaut", async () => {
    render(<FormulaireConnexion />);
    await saisirEtEnvoyer();

    await waitFor(() =>
      expect(seConnecter).toHaveBeenCalledWith({
        identifiant: "gerant",
        motDePasse: "gerant123",
        memoriser: false,
      }),
    );
  });

  it("la rend persistante si l'utilisateur le demande", async () => {
    render(<FormulaireConnexion />);

    await userEvent.click(
      screen.getByRole("checkbox", { name: /rester connecté sur cet appareil/i }),
    );
    await saisirEtEnvoyer();

    await waitFor(() =>
      expect(seConnecter).toHaveBeenCalledWith(
        expect.objectContaining({ memoriser: true }),
      ),
    );
  });

  it("renvoie vers le tableau de bord après une connexion réussie", async () => {
    render(<FormulaireConnexion />);
    await saisirEtEnvoyer();

    await waitFor(() => expect(routeur.replace).toHaveBeenCalledWith("/dashboard"));
  });
});
