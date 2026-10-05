import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EcranProduits } from "./ecran-produits";
import { attendreAucuneInfraction } from "@/lib/aide-accessibilite";
import type { Produit } from "@/lib/types";

const GERANT = {
  id: 1, nom: "Ouattara", prenom: "Gerant", matricule: "MAT-0001",
  sexe: "MASCULIN" as const, dateNaissance: "1985-01-15",
  identifiant: "gerant", role: "GERANT" as const, actif: true,
};

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/components/auth/session", () => ({
  useSession: () => ({ utilisateur: GERANT, deconnecter: vi.fn(), deconnexionEnCours: false }),
}));
vi.mock("@/lib/produits", () => ({ listerProduits: vi.fn(), creerProduit: vi.fn() }));
vi.mock("@/lib/notifier", () => ({
  notifier: { erreur: vi.fn(), succes: vi.fn(), pendant: vi.fn(), apresRedirection: vi.fn() },
}));

const { listerProduits } = await import("@/lib/produits");

const PRODUIT: Produit = {
  id: 1, nom: "Riz parfumé 25 kg", description: "Sac importé",
  prixAchat: 14500, prixVente: 17500, unite: "SACHET",
  quantiteStock: 9, seuilAlerte: 15, enAlerteStock: true,
};

beforeEach(() => {
  vi.mocked(listerProduits).mockResolvedValue({
    content: [PRODUIT],
    page: { size: 12, number: 0, totalElements: 1, totalPages: 1 },
  });
});

describe("accessibilité de l'écran Produits", () => {
  it("ne présente aucune infraction, catalogue chargé", async () => {
    const { container } = render(<EcranProduits />);
    await screen.findByText("Riz parfumé 25 kg");

    await attendreAucuneInfraction(container);
  });

  it("ne présente aucune infraction une fois la modale ouverte", async () => {
    const { container } = render(<EcranProduits />);
    await screen.findByText("Riz parfumé 25 kg");

    await userEvent.click(screen.getByRole("button", { name: /ajouter un produit/i }));
    await screen.findByRole("dialog");

    await attendreAucuneInfraction(container);
  });

  /**
   * L'alerte de stock ne doit pas reposer sur la seule couleur rouge : un
   * utilisateur daltonien ou un lecteur d'écran doit recevoir l'information.
   */
  it("double l'alerte de stock d'un libellé, pas seulement d'une couleur", async () => {
    render(<EcranProduits />);
    expect(await screen.findByText("Stock bas")).toBeInTheDocument();
  });

  it("annonce le nombre de résultats sans exiger de relire la page", async () => {
    render(<EcranProduits />);
    const compteur = await screen.findByText(/référence/i);
    expect(compteur).toHaveAttribute("aria-live", "polite");
  });
});
