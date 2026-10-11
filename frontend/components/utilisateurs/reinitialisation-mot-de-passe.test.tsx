import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";
import { ReinitialisationMotDePasse } from "./reinitialisation-mot-de-passe";
import type { Utilisateur } from "@/lib/types";

vi.mock("@/lib/utilisateurs", () => ({ reinitialiserMotDePasse: vi.fn() }));
vi.mock("@/lib/notifier", () => ({
  notifier: {
    erreur: vi.fn(),
    succes: vi.fn(),
    pendant: vi.fn((promesse: Promise<unknown>) => promesse),
    apresRedirection: vi.fn(),
  },
}));

const { reinitialiserMotDePasse } = await import("@/lib/utilisateurs");

const VENDEUSE: Utilisateur = {
  id: 4,
  nom: "Kone",
  prenom: "Awa",
  matricule: "MAT-5001",
  sexe: "FEMININ",
  dateNaissance: "1998-03-02",
  identifiant: "awa.kone",
  role: "VENDEUR",
  actif: true,
};

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

const monter = () =>
  render(
    <ReinitialisationMotDePasse
      utilisateur={VENDEUSE}
      onFermer={vi.fn()}
      onReinitialise={vi.fn()}
    />,
  );

const valider = () =>
  userEvent.click(screen.getByRole("button", { name: /réinitialiser$/i }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(reinitialiserMotDePasse).mockResolvedValue(VENDEUSE);
});

describe("réinitialisation par le gérant", () => {
  it("ne demande pas l’ancien mot de passe", () => {
    monter();

    expect(screen.queryByLabelText(/mot de passe actuel/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/nouveau mot de passe/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmer le mot de passe/i)).toBeInTheDocument();
  });

  it("prévient que les sessions du compte seront fermées", () => {
    monter();

    expect(screen.getByText(/sessions ouvertes seront fermées/i)).toBeInTheDocument();
  });

  /**
   * Une faute de frappe non détectée enfermerait l'employée dehors une
   * seconde fois, avec un mot de passe que personne ne connaît.
   */
  it("refuse deux saisies différentes sans appeler le serveur", async () => {
    monter();

    await userEvent.type(screen.getByLabelText(/nouveau mot de passe/i), "motdepasse1");
    await userEvent.type(screen.getByLabelText(/confirmer le mot de passe/i), "motdepasse2");
    await valider();

    expect(await screen.findByText(/les deux saisies diffèrent/i)).toBeInTheDocument();
    expect(reinitialiserMotDePasse).not.toHaveBeenCalled();
  });

  it("transmet le nouveau mot de passe une fois les saisies concordantes", async () => {
    monter();

    await userEvent.type(screen.getByLabelText(/nouveau mot de passe/i), "motdepasse1");
    await userEvent.type(screen.getByLabelText(/confirmer le mot de passe/i), "motdepasse1");
    await valider();

    await waitFor(() =>
      expect(reinitialiserMotDePasse).toHaveBeenCalledWith(4, "motdepasse1"),
    );
  });

  it("affiche le refus du serveur sous le champ visé", async () => {
    vi.mocked(reinitialiserMotDePasse).mockRejectedValue(
      refus400({ nouveauMotDePasse: "Le nouveau mot de passe doit faire au moins 8 caractères" }),
    );
    monter();

    await userEvent.type(screen.getByLabelText(/nouveau mot de passe/i), "motdepasse1");
    await userEvent.type(screen.getByLabelText(/confirmer le mot de passe/i), "motdepasse1");
    await valider();

    expect(await screen.findByText(/au moins 8 caractères/i)).toBeInTheDocument();
  });
});
