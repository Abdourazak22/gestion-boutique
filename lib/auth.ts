import { api, jeton, statutHttp } from "./api";
import type { Utilisateur } from "./types";

interface ConnexionResponse {
  jeton: string;
  typeJeton: string;
  expireDansSecondes: number;
  utilisateur: Utilisateur;
}

export interface Identifiants {
  identifiant: string;
  motDePasse: string;
  /** Décoché, le jeton ne survit pas à la fermeture de l'onglet. */
  memoriser: boolean;
}

/** `POST /api/auth/connexion` — émet le jeton et le met en place. */
export async function seConnecter({
  identifiant,
  motDePasse,
  memoriser,
}: Identifiants): Promise<Utilisateur> {
  // Un jeton résiduel est effacé avant toute tentative : en cas d'échec on ne
  // garde pas un jeton périmé qui polluerait les requêtes suivantes.
  jeton.effacer();

  const { data } = await api.post<ConnexionResponse>("/auth/connexion", {
    identifiant,
    motDePasse,
  });
  jeton.ecrire(data.jeton, memoriser);
  return data.utilisateur;
}

/**
 * `GET /api/auth/moi` — profil du porteur du jeton. Sert aussi de contrôle de
 * validité au chargement : un jeton expiré ou révoqué renvoie 401,
 * l'intercepteur d'`api.ts` purge alors la session.
 */
export async function profil(): Promise<Utilisateur> {
  const { data } = await api.get<Utilisateur>("/auth/moi");
  return data;
}

/**
 * `PATCH /api/auth/mot-de-passe` — changement de son propre mot de passe.
 *
 * Le serveur révoque au passage TOUS les jetons du compte, celui en cours
 * compris : l'appelant doit donc considérer sa session comme terminée et
 * renvoyer vers l'écran de connexion. Un mot de passe actuel faux renvoie 401,
 * un nouveau identique à l'ancien renvoie 409.
 */
export async function changerMotDePasse(
  motDePasseActuel: string,
  nouveauMotDePasse: string,
): Promise<void> {
  await api.patch("/auth/mot-de-passe", { motDePasseActuel, nouveauMotDePasse });
}

/**
 * Déconnexion.
 *
 * Oublier le jeton côté navigateur ne suffit pas : il reste valable jusqu'à son
 * expiration, donc rejouable s'il a fuité. `POST /api/auth/deconnexion`
 * incrémente la version des jetons du compte et invalide instantanément tout ce
 * qui a été émis avant, sur tous les appareils.
 *
 * Le nettoyage local a lieu dans tous les cas : si le serveur est injoignable,
 * l'utilisateur a quand même demandé à partir.
 *
 * @returns `true` si le serveur a bien révoqué, `false` s'il n'a pas répondu
 */
export async function seDeconnecter(): Promise<boolean> {
  try {
    await api.post("/auth/deconnexion");
    return true;
  } catch (erreur) {
    // 401 : le jeton était déjà révoqué — c'est l'état voulu, pas un échec.
    return statutHttp(erreur) === 401;
  } finally {
    jeton.effacer();
  }
}
