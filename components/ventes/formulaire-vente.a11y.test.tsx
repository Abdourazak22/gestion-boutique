import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormulaireVente } from "./formulaire-vente";
import { attendreAucuneInfraction } from "@/lib/aide-accessibilite";
import type { Produit } from "@/lib/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/produits", () => ({ listerProduits: vi.fn(), produitParId: vi.fn() }));
vi.mock("@/lib/achats", () => ({ enregistrerAchat: vi.fn() }));
vi.mock("@/lib/notifier", () => ({
  notifier: { erreur: vi.fn(), succes: vi.fn(), pendant: vi.fn(), apresRedirection: vi.fn() },
}));

const { listerProduits } = await import("@/lib/produits");

const RIZ: Produit = {
  id: 1, nom: "Riz", description: null, prixAchat: 4500, prixVente: 5500,
  unite: "SACHET", quantiteStock: 3, seuilAlerte: 2, enAlerteStock: false,
};

beforeEach(() => {
  vi.mocked(listerProduits).mockResolvedValue({
    content: [RIZ],
    page: { size: 8, number: 0, totalElements: 1, totalPages: 1 },
  });
});

describe("accessibilité de la caisse", () => {
  it("ne présente aucune infraction, panier vide", async () => {
    const { container } = render(<FormulaireVente />);
    await screen.findByRole("button", { name: /^Riz/ });

    await attendreAucuneInfraction(container);
  });

  it("ne présente aucune infraction, panier rempli", async () => {
    const { container } = render(<FormulaireVente />);
    await userEvent.click(await screen.findByRole("button", { name: /^Riz/ }));

    await attendreAucuneInfraction(container);
  });

  it("étiquette la recherche et les champs client", async () => {
    render(<FormulaireVente />);

    expect(screen.getByLabelText(/rechercher un produit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nom du client/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/téléphone/i)).toBeInTheDocument();
  });

  /** Chaque champ de quantité doit être distinguable des autres lignes. */
  it("étiquette la quantité de chaque ligne du panier", async () => {
    render(<FormulaireVente />);
    await userEvent.click(await screen.findByRole("button", { name: /^Riz/ }));

    const quantite = screen.getByLabelText(/quantité/i);
    expect(quantite).toHaveAttribute("id", "quantite-1");
    expect(quantite).toHaveAttribute("max", "3");
    expect(quantite).toHaveAttribute("min", "1");
  });

  it("nomme le bouton de retrait par le produit concerné", async () => {
    render(<FormulaireVente />);
    await userEvent.click(await screen.findByRole("button", { name: /^Riz/ }));

    expect(
      screen.getByRole("button", { name: /retirer riz du panier/i }),
    ).toBeInTheDocument();
  });

  it("désactive l'encaissement tant que le panier est vide, plutôt que de le cacher", async () => {
    render(<FormulaireVente />);
    await screen.findByRole("button", { name: /^Riz/ });

    // Un bouton désactivé reste annoncé et explique l'état ; un bouton absent
    // laisse l'utilisateur chercher.
    expect(screen.getByRole("button", { name: /encaisser/i })).toBeDisabled();
  });
});
