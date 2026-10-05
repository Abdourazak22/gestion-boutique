import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Synthese } from "./synthese";
import { attendreAucuneInfraction } from "@/lib/aide-accessibilite";
import type { Statistiques } from "@/lib/types";

const GERANT = {
  id: 1, nom: "Ouattara", prenom: "Gerant", matricule: "MAT-0001",
  sexe: "MASCULIN" as const, dateNaissance: "1985-01-15",
  identifiant: "gerant", role: "GERANT" as const, actif: true,
};

vi.mock("@/components/auth/session", () => ({
  useSession: () => ({ utilisateur: GERANT, deconnecter: vi.fn(), deconnexionEnCours: false }),
}));
vi.mock("@/lib/statistiques", async (original) => ({
  ...(await original<typeof import("@/lib/statistiques")>()),
  chargerStatistiques: vi.fn(),
}));
vi.mock("@/lib/achats", () => ({ listerAchats: vi.fn() }));
vi.mock("@/lib/produits", () => ({ listerAlertesStock: vi.fn() }));

const { chargerStatistiques } = await import("@/lib/statistiques");
const { listerAchats } = await import("@/lib/achats");
const { listerAlertesStock } = await import("@/lib/produits");

const STATS: Statistiques = {
  du: "2026-10-01",
  au: "2026-10-05",
  ventes: { nombre: 4, chiffreAffaires: 109500, marge: 19000 },
  livraisons: { nombre: 2, montantTotal: 48750 },
  stock: { references: 3, valeurAchat: 453200, valeurVente: 554500, enAlerte: 1 },
  ventesParJour: [{ jour: "2026-10-03", nombre: 4, montant: 109500 }],
  meilleuresVentes: [
    { produitId: 1, nom: "Riz", quantite: 6, chiffreAffaires: 33000, marge: 6000 },
  ],
};

beforeEach(() => {
  vi.mocked(chargerStatistiques).mockResolvedValue(STATS);
  vi.mocked(listerAchats).mockResolvedValue({
    content: [],
    page: { size: 5, number: 0, totalElements: 0, totalPages: 0 },
  });
  vi.mocked(listerAlertesStock).mockResolvedValue({
    content: [],
    page: { size: 6, number: 0, totalElements: 0, totalPages: 0 },
  });
});

describe("accessibilité du tableau de bord", () => {
  it("ne présente aucune infraction, données chargées", async () => {
    const { container } = render(<Synthese />);
    await screen.findByText(/Chiffre d’affaires/i);

    await attendreAucuneInfraction(container);
  });

  /**
   * Un graphique en barres ne dit rien à un lecteur d'écran. Le composant
   * fournit un tableau de substitution qui porte toutes les valeurs.
   */
  it("fournit un équivalent textuel du graphique", async () => {
    render(<Synthese />);
    await screen.findByText(/Ventes de la période/i);

    const substitution = screen.getByRole("table", {
      name: /montant encaissé par pas de temps/i,
    });
    expect(substitution).toBeInTheDocument();
  });

  it("rend chaque barre atteignable au clavier, avec sa valeur dans le nom", async () => {
    render(<Synthese />);
    await screen.findByText(/Ventes de la période/i);

    // Un bouton par pas de temps : le lecteur annonce « Sam : 109 500 FCFA ».
    const barres = screen.getAllByRole("button", { name: /FCFA/ });
    expect(barres.length).toBeGreaterThan(0);
  });

  it("nomme la région des filtres de période", async () => {
    render(<Synthese />);
    expect(screen.getByRole("region", { name: /période analysée/i })).toBeInTheDocument();
  });

  it("signale l'état de chargement aux technologies d'assistance", async () => {
    render(<Synthese />);
    // Les tuiles de substitution portent un rôle « status » et aria-busy.
    expect(screen.getAllByLabelText(/chargement/i).length).toBeGreaterThan(0);
  });
});
