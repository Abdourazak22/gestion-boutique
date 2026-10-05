/**
 * Messages qui doivent survivre à un changement de page.
 *
 * L'expiration de session renvoie vers /login par un rechargement complet
 * (`window.location.href`) : tout toast émis juste avant est détruit avec la
 * page. On range donc le message, et la page d'arrivée l'affiche.
 *
 * Volontairement sans dépendance à react-hot-toast : ce module est importé par
 * `api.ts`, qui doit rester utilisable côté serveur.
 */

const CLE = "boutiquex.message";

export type TonMessage = "erreur" | "succes";

export interface MessageDiffere {
  ton: TonMessage;
  texte: string;
}

export function differerMessage(ton: TonMessage, texte: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CLE, JSON.stringify({ ton, texte }));
  } catch {
    /* stockage indisponible : le message est simplement perdu */
  }
}

/** Lit et efface le message en attente : il ne doit s'afficher qu'une fois. */
export function consommerMessageDiffere(): MessageDiffere | null {
  if (typeof window === "undefined") return null;
  try {
    const brut = window.sessionStorage.getItem(CLE);
    if (!brut) return null;
    window.sessionStorage.removeItem(CLE);

    const valeur = JSON.parse(brut) as unknown;
    // Le contenu vient du stockage du navigateur : on ne lui fait pas confiance.
    if (
      typeof valeur === "object" &&
      valeur !== null &&
      "texte" in valeur &&
      typeof (valeur as MessageDiffere).texte === "string"
    ) {
      const { ton, texte } = valeur as MessageDiffere;
      return { ton: ton === "succes" ? "succes" : "erreur", texte };
    }
    return null;
  } catch {
    return null;
  }
}
