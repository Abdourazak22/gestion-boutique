import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Catalogue } from "./catalogue";
import type { Paginee, Produit } from "@/lib/types";

vi.mock("@/lib/produits", () => ({ listerProduits: vi.fn() }));
const { listerProduits } = await import("@/lib/produits");

const PRODUIT: Produit = {
  id: 1,
  nom: "Riz parfumé 25 kg",
  description: null,
  prixAchat: 14500,
  prixVente: 17500,
  unite: "SACHET",
  quantiteStock: 42,
  seuilAlerte: 15,
  enAlerteStock: false,
};

const page = (
  content: Produit[],
  meta: Partial<Paginee<Produit>["page"]> = {},
): Paginee<Produit> => ({
  content,
  page: { size: 12, number: 0, totalElements: content.length, totalPages: 1, ...meta },
});

beforeEach(() => {
  vi.mocked(listerProduits).mockReset();
});

describe("catalogue", () => {
  it("affiche les produits reçus du serveur", async () => {
    vi.mocked(listerProduits).mockResolvedValue(page([PRODUIT]));

    render(<Catalogue />);

    expect(await screen.findByText("Riz parfumé 25 kg")).toBeInTheDocument();
    expect(screen.getByText("En stock")).toBeInTheDocument();
  });

  it("signale un produit sous son seuil", async () => {
    vi.mocked(listerProduits).mockResolvedValue(
      page([{ ...PRODUIT, quantiteStock: 9, seuilAlerte: 12, enAlerteStock: true }]),
    );

    render(<Catalogue />);

    expect(await screen.findByText("Stock bas")).toBeInTheDocument();
  });

  it("dit clairement qu'un catalogue vide est vide", async () => {
    vi.mocked(listerProduits).mockResolvedValue(page([]));

    render(<Catalogue />);

    expect(await screen.findByText("Aucun produit trouvé")).toBeInTheDocument();
  });

  /**
   * Le bug : la page 5 d'une liste qui n'en a qu'une renvoyait `content: []`.
   * L'écran affirmait alors « le catalogue est vide » - faux - et masquait la
   * pagination faute de pages, sans aucun moyen de revenir.
   */
  it("ne prétend pas que la liste est vide quand c'est seulement la page qui l'est", async () => {
    vi.mocked(listerProduits).mockResolvedValue(
      page([], { number: 5, totalElements: 2, totalPages: 1 }),
    );

    render(<Catalogue />);

    expect(await screen.findByText("Cette page ne contient rien")).toBeInTheDocument();
    expect(screen.queryByText("Aucun produit trouvé")).not.toBeInTheDocument();
  });

  it("offre un retour à la première page, qui recharge bien la page 0", async () => {
    // On rejoue le vrai parcours : l'utilisateur pagine, puis la liste
    // raccourcit sous ses pieds et sa page n'existe plus.
    vi.mocked(listerProduits).mockImplementation(async (options) =>
      options?.page === 0
        ? page([PRODUIT], { number: 0, totalElements: 13, totalPages: 2 })
        : page([], { number: 1, totalElements: 1, totalPages: 1 }),
    );

    render(<Catalogue />);
    await screen.findByText("Riz parfumé 25 kg");

    await userEvent.click(screen.getByRole("button", { name: /suivant/i }));
    const retour = await screen.findByRole("button", { name: /première page/i });

    await userEvent.click(retour);

    expect(await screen.findByText("Riz parfumé 25 kg")).toBeInTheDocument();
    expect(screen.queryByText("Cette page ne contient rien")).not.toBeInTheDocument();
  });

  it("montre l'erreur et propose de réessayer", async () => {
    vi.mocked(listerProduits).mockRejectedValue(new Error("réseau coupé"));

    render(<Catalogue />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /réessayer/i })).toBeInTheDocument();
  });

  it("délègue la recherche au serveur après la frappe", async () => {
    vi.mocked(listerProduits).mockResolvedValue(page([PRODUIT]));
    render(<Catalogue />);
    await screen.findByText("Riz parfumé 25 kg");

    await userEvent.type(screen.getByLabelText(/rechercher un produit/i), "riz");

    // La recherche est envoyée au serveur, pas appliquée sur la page courante :
    // lui seul détient le catalogue entier.
    await waitFor(() =>
      expect(vi.mocked(listerProduits)).toHaveBeenCalledWith(
        expect.objectContaining({ nom: "riz", page: 0 }),
        expect.anything(),
      ),
    );
  });
});
