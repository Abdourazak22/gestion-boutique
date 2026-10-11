import { axe } from "vitest-axe";
import { expect } from "vitest";

/**
 * Passe axe-core sur un fragment rendu et échoue en nommant chaque infraction.
 *
 * Ce qu'axe sait voir dans jsdom : rôles et noms accessibles, étiquettes de
 * formulaire, attributs ARIA invalides, identifiants dupliqués, ordre des
 * titres, régions. Ce qu'il ne sait PAS voir ici : le contraste des couleurs
 * (jsdom ne calcule aucun style), l'ordre de tabulation réel et la restitution
 * d'un lecteur d'écran. Ces trois points restent à vérifier en navigateur.
 */
export async function attendreAucuneInfraction(element: HTMLElement) {
  const resultat = await axe(element);
  const infractions = resultat.violations;

  if (infractions.length > 0) {
    const detail = infractions
      .map((v) => {
        const cibles = v.nodes.map((n) => `        ${n.html}`).join("\n");
        return `  [${v.impact}] ${v.id} : ${v.help}\n${cibles}`;
      })
      .join("\n");
    throw new Error(`${infractions.length} infraction(s) d'accessibilité :\n${detail}`);
  }

  expect(infractions).toHaveLength(0);
}
