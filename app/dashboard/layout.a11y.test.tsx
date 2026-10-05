import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { NavMobile } from "@/components/nav-mobile";
import { attendreAucuneInfraction } from "@/lib/aide-accessibilite";

const GERANT = {
  id: 1, nom: "Ouattara", prenom: "Gerant", matricule: "MAT-0001",
  sexe: "MASCULIN" as const, dateNaissance: "1985-01-15",
  identifiant: "gerant", role: "GERANT" as const, actif: true,
};

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/components/auth/session", () => ({
  useSession: () => ({ utilisateur: GERANT, deconnecter: vi.fn(), deconnexionEnCours: false }),
}));
vi.mock("@/lib/produits", () => ({ listerAlertesStock: vi.fn().mockResolvedValue({
  content: [], page: { size: 1, number: 0, totalElements: 0, totalPages: 0 },
}) }));

describe("accessibilité de la coquille applicative", () => {
  it("ne présente aucune infraction, barres et navigations réunies", async () => {
    const { container } = render(
      <div>
        <Sidebar />
        <div>
          <Topbar />
          <main>contenu</main>
        </div>
        <NavMobile />
      </div>,
    );
    await screen.findAllByRole("navigation");

    await attendreAucuneInfraction(container);
  });

  /**
   * Les deux navigations coexistent dans le DOM, le CSS en masque une selon la
   * largeur. Des noms distincts évitent deux repères homonymes dans l'arbre
   * d'accessibilité si cette règle vient à changer.
   */
  it("nomme distinctement les deux navigations", async () => {
    render(
      <div>
        <Sidebar />
        <NavMobile />
      </div>,
    );

    const navigations = await screen.findAllByRole("navigation");
    const noms = navigations.map((n) => n.getAttribute("aria-label"));
    expect(new Set(noms).size).toBe(noms.length);
  });

  it("expose les repères attendus : bannière, recherche et navigation", async () => {
    render(
      <div>
        <Sidebar />
        <Topbar />
        <NavMobile />
      </div>,
    );

    expect(await screen.findByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(screen.getAllByRole("navigation")).toHaveLength(2);
  });
});
