import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormulaireVente } from "./formulaire-vente";
import type { Paginee, Produit } from "@/lib/types";

const remplacer = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: remplacer }) }));
vi.mock("@/lib/produits", () => ({ listerProduits: vi.fn(), produitParId: vi.fn() }));
vi.mock("@/lib/achats", () => ({ enregistrerAchat: vi.fn() }));
vi.mock("@/lib/notifier", () => ({
  notifier: {
    erreur: vi.fn(),
    succes: vi.fn(),
    pendant: vi.fn((promesse: Promise<unknown>) => promesse),
    apresRedirection: vi.fn(),
  },
}));

const { listerProduits, produitParId } = await import("@/lib/produits");
const { enregistrerAchat } = await import("@/lib/achats");

const produit = (p: Partial<Produit> & { id: number; nom: string }): Produit => ({
  description: null,
  prixAchat: 1000,
  prixVente: 1500,
  unite: "PIECE",
  quantiteStock: 10,
  seuilAlerte: 2,
  enAlerteStock: false,
  ...p,
});

const RIZ = produit({ id: 1, nom: "Riz", prixVente: 5500, quantiteStock: 3 });
const SUCRE = produit({ id: 2, nom: "Sucre", prixVente: 1000, quantiteStock: 10 });

const catalogue = (produits: Produit[]): Paginee<Produit> => ({
  content: produits,
  page: { size: 8, number: 0, totalElements: produits.length, totalPages: 1 },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listerProduits).mockResolvedValue(catalogue([RIZ, SUCRE]));
});

/**
 * Le bouton d'un produit a pour nom accessible « Riz5 500 FCFA - 3 pièce en
 * stock ». On l'ancre donc au début : « Retirer Riz du panier », lui, ne
 * commence pas par le nom du produit.
 */
const ajouter = async (nom: string) =>
  userEvent.click(await screen.findByRole("button", { name: new RegExp(`^${nom}`) }));

/**
 * Espace fine insécable d'`Intl` en français. On compare le `textContent` brut
 * plutôt que d'utiliser `toHaveTextContent`, qui normalise les blancs et
 * confondrait cette espace avec une espace ordinaire.
 */
const FINE = "\u202f";

/** Le montant total du panier, lu sur la ligne « Total ». */
const totalAffiche = () => screen.getByText("Total").nextElementSibling?.textContent;

describe("composition du panier", () => {
  it("part d'un panier vide", async () => {
    render(<FormulaireVente />);
    await screen.findByRole("button", { name: /Riz/i });

    expect(screen.getByText(/Aucun article/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /encaisser/i })).toBeDisabled();
  });

  it("ajoute un produit et calcule le total", async () => {
    render(<FormulaireVente />);
    await ajouter("Riz");

    expect(screen.getByLabelText(/quantité/i)).toHaveValue(1);
    expect(totalAffiche()).toBe(`5${FINE}500 FCFA`);
    expect(screen.getByRole("button", { name: /encaisser/i })).toBeEnabled();
  });

  /**
   * Le serveur refuse deux lignes sur le même produit (« regroupez-le en une
   * seule ligne »). Un deuxième clic doit donc incrémenter, pas dupliquer.
   */
  it("regroupe au lieu de créer une seconde ligne", async () => {
    render(<FormulaireVente />);
    await ajouter("Riz");
    await ajouter("Riz");

    const quantites = screen.getAllByLabelText(/quantité/i);
    expect(quantites).toHaveLength(1);
    expect(quantites[0]).toHaveValue(2);
    expect(totalAffiche()).toBe(`11${FINE}000 FCFA`);
  });

  it("ne dépasse jamais le stock connu", async () => {
    render(<FormulaireVente />);
    // Riz n'a que 3 en stock.
    await ajouter("Riz");
    await ajouter("Riz");
    await ajouter("Riz");

    expect(screen.getByLabelText(/quantité/i)).toHaveValue(3);
    expect(await screen.findByText(/Stock atteint/i)).toBeInTheDocument();
  });

  it("ramène dans le stock une quantité saisie trop grande", async () => {
    render(<FormulaireVente />);
    await ajouter("Riz");

    const champ = screen.getByLabelText(/quantité/i);
    await userEvent.clear(champ);
    await userEvent.type(champ, "99");

    expect(champ).toHaveValue(3);
  });

  it("ne descend jamais sous une unité", async () => {
    render(<FormulaireVente />);
    await ajouter("Riz");
    await ajouter("Riz");

    const champ = screen.getByLabelText(/quantité/i);
    await userEvent.clear(champ);

    expect(champ).toHaveValue(1);
  });

  it("retire une ligne du panier", async () => {
    render(<FormulaireVente />);
    await ajouter("Riz");
    await userEvent.click(screen.getByRole("button", { name: /retirer riz/i }));

    expect(screen.getByText(/Aucun article/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /encaisser/i })).toBeDisabled();
  });

  it("empêche d'ajouter un produit épuisé", async () => {
    vi.mocked(listerProduits).mockResolvedValue(
      catalogue([produit({ id: 3, nom: "Huile", quantiteStock: 0 })]),
    );
    render(<FormulaireVente />);

    expect(await screen.findByText(/Épuisé/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Huile/i })).toBeDisabled();
  });
});

describe("encaissement", () => {
  it("envoie les lignes et le client, puis renvoie à l'historique", async () => {
    vi.mocked(enregistrerAchat).mockResolvedValue({
      id: 7,
      numero: "ACH-20261005-0001",
      nomClient: "Esther",
      telephoneClient: null,
      dateAchat: "2026-10-05T10:00:00",
      vendeur: "Gerant Ouattara",
      montantTotal: 6500,
      lignes: [],
    });

    render(<FormulaireVente />);
    await ajouter("Riz");
    await ajouter("Sucre");
    await userEvent.type(screen.getByLabelText(/nom du client/i), "Esther");
    await userEvent.click(screen.getByRole("button", { name: /encaisser/i }));

    await waitFor(() =>
      expect(vi.mocked(enregistrerAchat)).toHaveBeenCalledWith({
        nomClient: "Esther",
        telephoneClient: undefined,
        lignes: [
          { produitId: 1, quantite: 1 },
          { produitId: 2, quantite: 1 },
        ],
      }),
    );
    await waitFor(() => expect(remplacer).toHaveBeenCalledWith("/dashboard/ventes"));
  });

  it("omet le nom quand il est vide : une vente anonyme reste valide", async () => {
    vi.mocked(enregistrerAchat).mockResolvedValue({
      id: 8,
      numero: "ACH-20261005-0002",
      nomClient: null,
      telephoneClient: null,
      dateAchat: "2026-10-05T10:00:00",
      vendeur: "Gerant Ouattara",
      montantTotal: 5500,
      lignes: [],
    });

    render(<FormulaireVente />);
    await ajouter("Riz");
    await userEvent.click(screen.getByRole("button", { name: /encaisser/i }));

    await waitFor(() =>
      expect(vi.mocked(enregistrerAchat)).toHaveBeenCalledWith(
        expect.objectContaining({ nomClient: undefined }),
      ),
    );
  });

  /**
   * Après un refus pour stock insuffisant, le panier gardait les stocks lus à
   * l'ajout : le plafond affiché était faux et rejouer la vente échouait
   * pareil. Les lignes sont donc relues en base.
   */
  it("resynchronise les stocks du panier après un refus du serveur", async () => {
    vi.mocked(enregistrerAchat).mockRejectedValue(new Error("Stock insuffisant"));
    vi.mocked(produitParId).mockResolvedValue({ ...RIZ, quantiteStock: 1 });

    render(<FormulaireVente />);
    await ajouter("Riz");
    await ajouter("Riz");
    expect(screen.getByLabelText(/quantité/i)).toHaveValue(2);

    await userEvent.click(screen.getByRole("button", { name: /encaisser/i }));

    await waitFor(() => expect(vi.mocked(produitParId)).toHaveBeenCalledWith(1));
    // Quantité ramenée au stock réellement disponible.
    await waitFor(() => expect(screen.getByLabelText(/quantité/i)).toHaveValue(1));
    expect(remplacer).not.toHaveBeenCalled();
  });

  it("retire du panier un produit disparu du catalogue", async () => {
    vi.mocked(enregistrerAchat).mockRejectedValue(new Error("Produit introuvable"));
    vi.mocked(produitParId).mockRejectedValue({
      isAxiosError: true,
      response: { status: 404 },
    });

    render(<FormulaireVente />);
    await ajouter("Riz");
    await userEvent.click(screen.getByRole("button", { name: /encaisser/i }));

    await waitFor(() => expect(screen.getByText(/Aucun article/i)).toBeInTheDocument());
  });
});
