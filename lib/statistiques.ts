import { api } from "./api";
import type { Statistiques, VenteParJour } from "./types";

/**
 * Accès aux agrégats du tableau de bord.
 *
 * Tout est calculé par la base : ce fichier ne fait plus aucune somme. Il ne
 * reste ici que des conversions de dates et le remplissage des journées creuses,
 * que le serveur ne renvoie pas pour garder sa réponse courte.
 */

export interface Periode {
  /** Bornes incluses, au format `yyyy-MM-dd`. */
  du: string;
  au: string;
}

/** `GET /api/statistiques` : réservé au gérant. */
export async function chargerStatistiques(
  { du, au }: Periode,
  signal?: AbortSignal,
): Promise<Statistiques> {
  const { data } = await api.get<Statistiques>("/statistiques", {
    params: { du, au },
    signal,
  });
  return data;
}

/* --- Dates ---------------------------------------------------------------- */

/** Format attendu par l'API, dans le fuseau local et non en UTC. */
export function jourIso(date: Date): string {
  const mois = `${date.getMonth() + 1}`.padStart(2, "0");
  const jour = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${mois}-${jour}`;
}

/** Minuit local, pour comparer des journées sans se faire piéger par l'heure. */
const versDate = (iso: string): Date => {
  const [annee, mois, jour] = iso.split("-").map(Number);
  return new Date(annee!, mois! - 1, jour!);
};

const decaler = (date: Date, jours: number): Date => {
  const copie = new Date(date);
  copie.setDate(copie.getDate() + jours);
  return copie;
};

const MS_PAR_JOUR = 86_400_000;

/** Nombre de journées de la période, bornes incluses. */
export function longueurEnJours({ du, au }: Periode): number {
  return Math.round((versDate(au).getTime() - versDate(du).getTime()) / MS_PAR_JOUR) + 1;
}

/**
 * Période de même longueur qui précède immédiatement celle-ci : c'est elle qui
 * donne sens à une évolution (« +12 % par rapport aux 7 jours précédents »).
 */
export function periodePrecedente(periode: Periode): Periode {
  const longueur = longueurEnJours(periode);
  const finPrecedente = decaler(versDate(periode.du), -1);
  return {
    du: jourIso(decaler(finPrecedente, -(longueur - 1))),
    au: jourIso(finPrecedente),
  };
}

/* --- Préréglages de période ---------------------------------------------- */

export type ClePeriode = "jour" | "semaine" | "mois" | "trimestre" | "personnalise";

export function periodePredefinie(cle: Exclude<ClePeriode, "personnalise">): Periode {
  const aujourdhui = new Date();
  const au = jourIso(aujourdhui);
  switch (cle) {
    case "jour":
      return { du: au, au };
    case "semaine":
      return { du: jourIso(decaler(aujourdhui, -6)), au };
    case "trimestre":
      return { du: jourIso(decaler(aujourdhui, -89)), au };
    case "mois":
    default:
      return {
        du: jourIso(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1)),
        au,
      };
  }
}

/* --- Remplissage des creux pour l'histogramme ---------------------------- */

export interface BarreVentes {
  cle: string;
  label: string;
  montant: number;
}

const JOURS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** Au-delà de ce nombre de journées, l'axe passe au mois : 365 barres ne se lisent pas. */
const SEUIL_REGROUPEMENT_MENSUEL = 62;

/**
 * Transforme les journées vendues en barres couvrant toute la période, creux
 * compris, sans quoi une semaine sans vente disparaîtrait de l'axe au lieu de
 * s'y montrer à zéro.
 */
export function barresDeVentes(
  ventesParJour: VenteParJour[],
  periode: Periode,
): BarreVentes[] {
  const longueur = longueurEnJours(periode);
  const parJour = new Map(ventesParJour.map((v) => [v.jour, v.montant]));

  if (longueur > SEUIL_REGROUPEMENT_MENSUEL) {
    const parMois = new Map<string, number>();
    for (const vente of ventesParJour) {
      const cle = vente.jour.slice(0, 7); // yyyy-MM
      parMois.set(cle, (parMois.get(cle) ?? 0) + vente.montant);
    }
    const barres: BarreVentes[] = [];
    const curseur = versDate(periode.du);
    curseur.setDate(1);
    const fin = versDate(periode.au);
    while (curseur <= fin) {
      const cle = jourIso(curseur).slice(0, 7);
      barres.push({
        cle,
        label: MOIS[curseur.getMonth()]!,
        montant: parMois.get(cle) ?? 0,
      });
      curseur.setMonth(curseur.getMonth() + 1);
    }
    return barres;
  }

  // Les noms de jours ne restent lisibles que sur deux semaines au plus ;
  // au-delà, le numéro du jour suffit à se repérer.
  const parNomDeJour = longueur <= 14;
  return Array.from({ length: longueur }, (_, i) => {
    const date = decaler(versDate(periode.du), i);
    const cle = jourIso(date);
    return {
      cle,
      label: parNomDeJour ? JOURS[date.getDay()]! : `${date.getDate()}`,
      montant: parJour.get(cle) ?? 0,
    };
  });
}
