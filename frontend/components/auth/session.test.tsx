import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { FournisseurSession } from "./session";
import type { Utilisateur } from "@/lib/types";

const routeur = { replace: vi.fn(), push: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => routeur,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/auth", () => ({ profil: vi.fn(), seDeconnecter: vi.fn() }));
vi.mock("@/lib/notifier", () => ({
  notifier: {
    erreur: vi.fn(),
    succes: vi.fn(),
    pendant: vi.fn(),
    apresRedirection: vi.fn(),
  },
}));

const { profil } = await import("@/lib/auth");

const GERANT: Utilisateur = {
  id: 1,
  nom: "Ouattara",
  prenom: "Gerant",
  matricule: "MAT-0001",
  sexe: "MASCULIN",
  dateNaissance: "1985-01-15",
  identifiant: "gerant",
  role: "GERANT",
  actif: true,
};

const CLE = "boutiquex.token";

const monter = () =>
  render(
    <FournisseurSession>
      <p>Contenu du tableau de bord</p>
    </FournisseurSession>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("accès à /dashboard sans être authentifié", () => {
  it("renvoie vers /login quand aucun jeton n'est stocké", async () => {
    monter();

    await waitFor(() => expect(routeur.replace).toHaveBeenCalledWith("/login"));
  });

  it("n'affiche jamais le contenu du tableau de bord sans jeton", async () => {
    monter();

    await waitFor(() => expect(routeur.replace).toHaveBeenCalled());
    expect(
      screen.queryByText("Contenu du tableau de bord"),
    ).not.toBeInTheDocument();
    // Ce que l'utilisateur voit à la place, le temps de la redirection.
    expect(screen.getByText(/chargement de la session/i)).toBeInTheDocument();
  });

  it("n'interroge pas l'API sans jeton", async () => {
    monter();

    await waitFor(() => expect(routeur.replace).toHaveBeenCalled());
    expect(profil).not.toHaveBeenCalled();
  });
});

describe("accès à /dashboard avec un jeton", () => {
  it("affiche le contenu une fois le profil obtenu", async () => {
    window.localStorage.setItem(CLE, "jeton-valide");
    vi.mocked(profil).mockResolvedValue(GERANT);

    monter();

    expect(
      await screen.findByText("Contenu du tableau de bord"),
    ).toBeInTheDocument();
    expect(routeur.replace).not.toHaveBeenCalled();
  });

  /**
   * « Rester connecté » décoché, qui est le cas par défaut : le jeton vit
   * dans sessionStorage. Il doit ouvrir l'accès comme l'autre, sans quoi
   * l'utilisateur serait renvoyé à la connexion juste après s'y être
   * authentifié.
   */
  it("accepte aussi un jeton de sessionStorage", async () => {
    window.sessionStorage.setItem(CLE, "jeton-valide");
    vi.mocked(profil).mockResolvedValue(GERANT);

    monter();

    expect(
      await screen.findByText("Contenu du tableau de bord"),
    ).toBeInTheDocument();
  });

  it("annonce l'indisponibilité plutôt que de tourner indéfiniment", async () => {
    window.localStorage.setItem(CLE, "jeton-valide");
    vi.mocked(profil).mockRejectedValue(new Error("réseau coupé"));

    monter();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/session indisponible/i)).toBeInTheDocument();
    expect(
      screen.queryByText("Contenu du tableau de bord"),
    ).not.toBeInTheDocument();
  });
});
