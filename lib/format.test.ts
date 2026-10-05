import { describe, expect, it } from "vitest";
import { dateCourte, dateHeure, dateLongue, fcfa, heure, initiales, nombre, pourcent } from "./format";

/**
 * Le cas qui compte ici est le fuseau horaire : `new Date("2026-10-01")` est
 * interprété en UTC par la spécification, alors qu'un `yyyy-MM-dd` seul désigne
 * une journée civile. Sur un fuseau négatif, l'affichage reculait d'un jour.
 */
describe("dates de l'API", () => {
  it("lit une date seule comme une journée locale, pas comme un instant UTC", () => {
    // Avant correction, ce test échouait sous un fuseau négatif : « 30 sept. ».
    expect(dateCourte("2026-10-01")).toBe("01 oct.");
    expect(dateLongue("1999-07-25")).toBe("25 juillet 1999");
  });

  it("garde l'heure d'un LocalDateTime complet", () => {
    expect(heure("2026-10-03T13:28:07")).toBe("13:28");
    expect(dateHeure("2026-10-03T13:28:07")).toBe("03 oct. à 13:28");
  });

  it("ne décale pas une date seule au changement d'heure", () => {
    // Nuit de passage à l'heure d'hiver en Europe : un décalage de fuseau
    // appliqué à minuit ferait basculer la journée.
    expect(dateCourte("2026-10-25")).toBe("25 oct.");
    expect(dateCourte("2026-03-29")).toBe("29 mars");
  });
});

/**
 * `Intl.NumberFormat("fr-FR")` sépare les milliers par une espace fine
 * insécable (U+202F), pas par une espace ordinaire. On l'écrit explicitement :
 * un test qui attendrait " " passerait sur une autre locale et masquerait un
 * vrai changement de format.
 */
const FINE = "\u202f";

describe("montants et nombres", () => {
  it("suffixe les montants en francs CFA sans décimale", () => {
    expect(fcfa(17500)).toBe(`17${FINE}500 FCFA`);
    expect(fcfa(0)).toBe("0 FCFA");
  });

  it("arrondit les montants à l'unité", () => {
    expect(fcfa(1234.56)).toBe(`1${FINE}235 FCFA`);
  });

  it("formate les pourcentages avec le nombre de décimales demandé", () => {
    expect(pourcent(22.456)).toBe("22 %");
    expect(pourcent(22.456, 1)).toBe("22.5 %");
  });

  it("sépare les milliers par une espace fine insécable", () => {
    expect(nombre(1284)).toBe(`1${FINE}284`);
  });
});

describe("initiales", () => {
  it("prend la première lettre des deux premiers mots", () => {
    expect(initiales("Awa Koné")).toBe("AK");
    expect(initiales("Jean Michel Dupont")).toBe("JM");
  });

  it("supporte un nom en un seul mot", () => {
    expect(initiales("Cheick")).toBe("C");
  });
});
