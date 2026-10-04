const devise = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

/** Montants en francs CFA — adapter ici pour changer de devise. */
export const fcfa = (montant: number): string => `${devise.format(montant)} FCFA`;

export const nombre = (valeur: number): string => devise.format(valeur);

export const pourcent = (valeur: number, decimales = 0): string =>
  `${valeur.toFixed(decimales)} %`;

/**
 * Analyse une date de l'API.
 *
 * `new Date("2026-10-01")` est interprété en UTC par la spécification, alors
 * qu'un `yyyy-MM-dd` seul désigne une journée civile : sur un fuseau négatif,
 * l'affichage reculait d'un jour. Ajouter l'heure force la lecture locale. Les
 * `LocalDateTime` complets, eux, sont déjà lus en local.
 */
const enDate = (iso: string): Date =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);

export const dateCourte = (iso: string): string =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(
    enDate(iso),
  );

export const dateLongue = (iso: string): string =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(enDate(iso));

/**
 * Heure d'un `LocalDateTime` de l'API. Celui-ci ne porte pas de fuseau : il est
 * donc lu comme une heure locale du navigateur, ce qui est exact tant que la
 * boutique et le serveur partagent le même fuseau (UTC+0).
 */
export const heure = (iso: string): string =>
  new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(enDate(iso));

export const dateHeure = (iso: string): string =>
  `${dateCourte(iso)} à ${heure(iso)}`;

export const initiales = (nom: string): string =>
  nom
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0]!.toUpperCase())
    .join("");
