import { describe, expect, it } from "vitest";
import {
  barresDeVentes,
  jourIso,
  longueurEnJours,
  periodePredefinie,
  periodePrecedente,
} from "./statistiques";
import type { VenteParJour } from "./types";

const vente = (jour: string, montant: number): VenteParJour => ({ jour, nombre: 1, montant });

describe("longueur d'une période", () => {
  it("compte les deux bornes", () => {
    expect(longueurEnJours({ du: "2026-10-03", au: "2026-10-03" })).toBe(1);
    expect(longueurEnJours({ du: "2026-09-27", au: "2026-10-03" })).toBe(7);
  });

  it("traverse un changement d'heure sans se décaler", () => {
    // Nuit du passage à l'heure d'hiver : une soustraction d'instants naïve
    // renverrait 31,04 jours et un arrondi à 32.
    expect(longueurEnJours({ du: "2026-10-01", au: "2026-10-31" })).toBe(31);
  });
});

/**
 * La période de comparaison doit avoir exactement la même longueur et finir la
 * veille : sans ça, l'évolution affichée sur le tableau de bord compare des
 * durées différentes et ne veut rien dire.
 */
describe("période précédente", () => {
  it("fait la même longueur et s'arrête la veille", () => {
    const p = { du: "2026-09-27", au: "2026-10-03" };
    expect(periodePrecedente(p)).toEqual({ du: "2026-09-20", au: "2026-09-26" });
    expect(longueurEnJours(periodePrecedente(p))).toBe(longueurEnJours(p));
  });

  it("gère une période d'un seul jour", () => {
    expect(periodePrecedente({ du: "2026-10-03", au: "2026-10-03" })).toEqual({
      du: "2026-10-02",
      au: "2026-10-02",
    });
  });
});

describe("préréglages", () => {
  it("cadrent sur aujourd'hui", () => {
    const aujourdhui = jourIso(new Date());
    expect(periodePredefinie("jour")).toEqual({ du: aujourdhui, au: aujourdhui });
    expect(periodePredefinie("semaine").au).toBe(aujourdhui);
    expect(longueurEnJours(periodePredefinie("semaine"))).toBe(7);
    expect(longueurEnJours(periodePredefinie("trimestre"))).toBe(90);
  });

  it("fait démarrer « mois en cours » au premier du mois", () => {
    expect(periodePredefinie("mois").du.slice(8)).toBe("01");
  });
});

/**
 * Le serveur ne renvoie que les journées ayant vendu. C'est au client de
 * combler les creux, sinon une semaine sans vente disparaîtrait de l'axe au
 * lieu de s'y montrer à zéro.
 */
describe("barres de l'histogramme", () => {
  it("couvre toute la période, zéros compris", () => {
    const barres = barresDeVentes([vente("2026-10-03", 109500)], {
      du: "2026-09-27",
      au: "2026-10-03",
    });

    expect(barres).toHaveLength(7);
    expect(barres.map((b) => b.montant)).toEqual([0, 0, 0, 0, 0, 0, 109500]);
  });

  it("ne perd ni ne double aucun montant", () => {
    const ventes = [vente("2026-10-01", 1000), vente("2026-10-03", 2500)];
    const barres = barresDeVentes(ventes, { du: "2026-10-01", au: "2026-10-03" });

    expect(barres.reduce((t, b) => t + b.montant, 0)).toBe(3500);
  });

  it("nomme les jours sur deux semaines au plus", () => {
    const barres = barresDeVentes([], { du: "2026-09-27", au: "2026-10-03" });
    // 2026-09-27 est un dimanche.
    expect(barres.map((b) => b.label)).toEqual(["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]);
  });

  it("passe au numéro du jour au-delà de deux semaines", () => {
    const barres = barresDeVentes([], { du: "2026-10-01", au: "2026-10-31" });
    expect(barres).toHaveLength(31);
    expect(barres[0]!.label).toBe("1");
    expect(barres[30]!.label).toBe("31");
  });

  it("regroupe par mois au-delà de 62 jours, pour que l'axe reste lisible", () => {
    const barres = barresDeVentes(
      [vente("2026-07-15", 1000), vente("2026-07-20", 500), vente("2026-09-02", 2000)],
      { du: "2026-07-06", au: "2026-10-03" },
    );

    expect(barres.map((b) => b.label)).toEqual(["juil.", "août", "sept.", "oct."]);
    // Les deux ventes de juillet sont additionnées dans la même barre.
    expect(barres[0]!.montant).toBe(1500);
    expect(barres[1]!.montant).toBe(0);
    expect(barres[2]!.montant).toBe(2000);
  });

  it("rend une barre unique pour une période d'un jour", () => {
    const barres = barresDeVentes([vente("2026-10-03", 42)], { du: "2026-10-03", au: "2026-10-03" });
    expect(barres).toEqual([{ cle: "2026-10-03", label: "Sam", montant: 42 }]);
  });
});

describe("jourIso", () => {
  it("formate en heure locale et non en UTC", () => {
    // `toISOString()` basculerait au jour précédent sur un fuseau négatif.
    expect(jourIso(new Date(2026, 9, 3))).toBe("2026-10-03");
    expect(jourIso(new Date(2026, 0, 1))).toBe("2026-01-01");
  });
});
