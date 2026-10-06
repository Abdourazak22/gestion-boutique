import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Inventaire } from "./inventaire";
import type { MouvementStock, Paginee, Produit } from "@/lib/types";

vi.mock("@/lib/produits", () => ({
  ajusterStock: vi.fn(),
  listerMouvements: vi.fn(),
}));
vi.mock("@/lib/notifier", () => ({
  notifier: {
    erreur: vi.fn(),
    succes: vi.fn(),
    pendant: vi.fn((promesse: Promise<unknown>) => promesse),
    apresRedirection: vi.fn(),
  },
}));

const { ajusterStock, listerMouvements } = await import("@/lib/produits");

const PRODUIT: Produit = {
  id: 7,
  nom: "Riz parfumé 25 kg",
  description: null,
  prixAchat: 14500,
  prixVente: 17500,
  unite: "SACHET",
  quantiteStock: 42,
  seuilAlerte: 15,
  enAlerteStock: false,
};

const REPRISE: MouvementStock = {
  id: 1,
  type: "INITIAL",
  variation: 42,
  stockAvant: 0,
  stockApres: 42,
  motif: null,
  commentaire: "Reprise du stock existant",
  reference: null,
  auteur: null,
  date: "2026-10-05T13:47:27.169197Z",
};

const journal = (mouvements: MouvementStock[]): Paginee<MouvementStock> => ({
  content: mouvements,
  page: { size: 8, number: 0, totalElements: mouvements.length, totalPages: 1 },
});

const monter = (surcharges: Partial<Produit> = {}) =>
  render(
    <Inventaire
      produit={{ ...PRODUIT, ...surcharges }}
      onFermer={vi.fn()}
      onAjuste={vi.fn()}
    />,
  );

const champComptee = () => screen.getByLabelText(/quantité comptée/i);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listerMouvements).mockResolvedValue(journal([REPRISE]));
  vi.mocked(ajusterStock).mockResolvedValue({ ...PRODUIT, quantiteStock: 39 });
});

describe("écart annoncé pendant le comptage", () => {
  it("part du stock enregistré et annonce une confirmation", async () => {
    monter();

    expect(champComptee()).toHaveValue(42);
    expect(
      await screen.findByText(/le comptage confirme le stock enregistré/i),
    ).toBeInTheDocument();
  });

  it("annonce un manquant quand on a compté moins", async () => {
    monter();

    await userEvent.clear(champComptee());
    await userEvent.type(champComptee(), "39");

    // Le gérant ne doit pas avoir à faire la soustraction lui-même.
    expect(await screen.findByText(/manquant de 3/i)).toBeInTheDocument();
  });

  it("annonce un excédent quand on a compté plus", async () => {
    monter();

    await userEvent.clear(champComptee());
    await userEvent.type(champComptee(), "45");

    expect(await screen.findByText(/excédent de 3/i)).toBeInTheDocument();
  });
});

describe("enregistrement de l'inventaire", () => {
  it("refuse un écart sans motif, sans appeler le serveur", async () => {
    monter();

    await userEvent.clear(champComptee());
    await userEvent.type(champComptee(), "39");
    await userEvent.click(
      screen.getByRole("button", { name: /enregistrer l’inventaire/i }),
    );

    expect(
      await screen.findByText(/un motif est obligatoire pour justifier un écart/i),
    ).toBeInTheDocument();
    expect(ajusterStock).not.toHaveBeenCalled();
  });

  it("transmet la quantité comptée et le motif, pas l’écart", async () => {
    monter();

    await userEvent.clear(champComptee());
    await userEvent.type(champComptee(), "39");
    await userEvent.selectOptions(screen.getByLabelText(/motif de l’écart/i), "CASSE");
    await userEvent.type(
      screen.getByLabelText(/commentaire/i),
      "Trois sachets éventrés",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /enregistrer l’inventaire/i }),
    );

    await waitFor(() =>
      expect(ajusterStock).toHaveBeenCalledWith(7, {
        quantiteComptee: 39,
        motif: "CASSE",
        commentaire: "Trois sachets éventrés",
      }),
    );
  });

  it("accepte un comptage conforme sans motif", async () => {
    vi.mocked(ajusterStock).mockResolvedValue(PRODUIT);
    monter();

    await userEvent.click(
      screen.getByRole("button", { name: /enregistrer l’inventaire/i }),
    );

    await waitFor(() =>
      expect(ajusterStock).toHaveBeenCalledWith(7, {
        quantiteComptee: 42,
        motif: null,
        commentaire: null,
      }),
    );
  });
});

describe("journal affiché à côté du comptage", () => {
  it("attribue la reprise initiale à personne", async () => {
    monter();

    expect(await screen.findByText("Stock initial")).toBeInTheDocument();
    // Auteur nul : la reprise précède la mise en place du journal.
    expect(screen.getByText(/reprise initiale/i)).toBeInTheDocument();
  });

  it("distingue une entrée d’une sortie autrement que par la couleur", async () => {
    vi.mocked(listerMouvements).mockResolvedValue(
      journal([
        {
          ...REPRISE,
          id: 3,
          type: "SORTIE",
          variation: -3,
          stockAvant: 42,
          stockApres: 39,
          commentaire: null,
          reference: "ACH-20261005-0001",
          auteur: "Gerant Ouattara",
        },
        {
          ...REPRISE,
          id: 2,
          type: "ENTREE",
          variation: 12,
          stockAvant: 30,
          stockApres: 42,
          commentaire: null,
          reference: "LIV-20261004-0001",
          auteur: "Gerant Ouattara",
        },
      ]),
    );

    monter();

    // Le signe est dans le texte : « − » pour une sortie, « + » pour une entrée.
    expect(await screen.findByText("−3 sachet")).toBeInTheDocument();
    expect(screen.getByText("+12 sachet")).toBeInTheDocument();
    expect(screen.getByText(/vente · ACH-20261005-0001/i)).toBeInTheDocument();
    expect(screen.getByText(/livraison · LIV-20261004-0001/i)).toBeInTheDocument();
  });
});
