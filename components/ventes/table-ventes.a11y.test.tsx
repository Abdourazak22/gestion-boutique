import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TableVentes } from "./table-ventes";
import { attendreAucuneInfraction } from "@/lib/aide-accessibilite";
import type { Achat } from "@/lib/types";

vi.mock("@/lib/achats", () => ({ listerAchats: vi.fn(), ouvrirTicket: vi.fn() }));
vi.mock("@/lib/notifier", () => ({
  notifier: { erreur: vi.fn(), succes: vi.fn(), pendant: vi.fn(), apresRedirection: vi.fn() },
}));

const { listerAchats } = await import("@/lib/achats");

const ACHAT: Achat = {
  id: 1,
  numero: "ACH-20261005-0001",
  nomClient: "Esther Kouadio",
  telephoneClient: "0700000000",
  dateAchat: "2026-10-05T11:42:00",
  vendeur: "Gerant Ouattara",
  montantTotal: 18500,
  lignes: [
    { produitId: 1, nomProduit: "Riz", quantite: 3, prixUnitaire: 5500, montantLigne: 16500 },
    { produitId: 2, nomProduit: "Sucre", quantite: 2, prixUnitaire: 1000, montantLigne: 2000 },
  ],
};

beforeEach(() => {
  vi.mocked(listerAchats).mockResolvedValue({
    content: [ACHAT],
    page: { size: 20, number: 0, totalElements: 1, totalPages: 1 },
  });
});

describe("accessibilité de l'historique des ventes", () => {
  it("ne présente aucune infraction, historique chargé", async () => {
    const { container } = render(<TableVentes />);
    await screen.findByText("ACH-20261005-0001");

    await attendreAucuneInfraction(container);
  });

  it("ne présente aucune infraction, ticket ouvert", async () => {
    const { container } = render(<TableVentes />);
    await userEvent.click(await screen.findByText("ACH-20261005-0001"));
    await screen.findByText(/Ticket ACH-20261005-0001/);

    await attendreAucuneInfraction(container);
  });

  it("étiquette les bornes de dates et le filtre", async () => {
    render(<TableVentes />);

    expect(screen.getByLabelText(/^du$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^au$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/filtrer les ventes affichées/i)).toBeInTheDocument();
  });

  /** Une case à cocher sans nom est inutilisable sans la voir. */
  it("nomme chaque case de sélection par son numéro de vente", async () => {
    render(<TableVentes />);
    await screen.findByText("ACH-20261005-0001");

    expect(
      screen.getByRole("checkbox", { name: /sélectionner la vente ACH-20261005-0001/i }),
    ).toBeInTheDocument();
  });

  /**
   * La ligne entière réagit au clic pour le confort du pointeur, mais un `<tr>`
   * n'est ni focalisable ni activable au clavier. Sans un vrai bouton, un
   * utilisateur sans souris ne pouvait ouvrir aucun ticket.
   */
  it("permet d'ouvrir un ticket au clavier seul", async () => {
    render(<TableVentes />);
    await screen.findByText("ACH-20261005-0001");

    const ouvrir = screen.getByRole("button", { name: /ouvrir le ticket ACH-20261005-0001/i });
    expect(ouvrir).toHaveAttribute("aria-expanded", "false");

    ouvrir.focus();
    expect(ouvrir).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByText(/Ticket ACH-20261005-0001/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /ouvrir le ticket ACH-20261005-0001/i }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("donne une légende au tableau et des en-têtes de colonne", async () => {
    render(<TableVentes />);
    await screen.findByText("ACH-20261005-0001");

    expect(screen.getByRole("table")).toHaveAccessibleName(/historique des achats clients/i);
    for (const e of screen.getAllByRole("columnheader")) {
      if (e.textContent?.trim()) expect(e).toHaveAttribute("scope", "col");
    }
  });
});
