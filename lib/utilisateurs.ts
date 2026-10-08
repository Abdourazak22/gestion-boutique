import { api } from "./api";
import type { Paginee, Role, Sexe, Utilisateur } from "./types";

/** Corps de `POST /api/utilisateurs` (`UtilisateurRequest`). */
export interface UtilisateurRequete {
  nom: string;
  prenom: string;
  matricule: string;
  sexe: Sexe;
  dateNaissance: string; // yyyy-MM-dd, obligatoirement dans le passé
  identifiant: string;
  motDePasse: string;
  role: Role;
}

/**
 * Corps de `PUT /api/utilisateurs/{id}` (`UtilisateurUpdateRequest`).
 * Ni l'identifiant ni le mot de passe ne se modifient ici : le premier est la
 * clé de connexion, le second a son propre endpoint.
 */
export type UtilisateurModification = Omit<
  UtilisateurRequete,
  "identifiant" | "motDePasse"
>;

/** `GET /api/utilisateurs` : réservé au gérant. */
export async function listerUtilisateurs(
  { page = 0, size = 20 } = {},
  signal?: AbortSignal,
): Promise<Paginee<Utilisateur>> {
  const { data } = await api.get<Paginee<Utilisateur>>("/utilisateurs", {
    params: { page, size },
    signal,
  });
  return data;
}

export async function creerUtilisateur(
  requete: UtilisateurRequete,
): Promise<Utilisateur> {
  const { data } = await api.post<Utilisateur>("/utilisateurs", requete);
  return data;
}

export async function modifierUtilisateur(
  id: number,
  requete: UtilisateurModification,
): Promise<Utilisateur> {
  const { data } = await api.put<Utilisateur>(`/utilisateurs/${id}`, requete);
  return data;
}

/**
 * `POST /api/utilisateurs/{id}/deconnexion` : révoque les jetons d'un compte.
 *
 * Utile quand un appareil est perdu ou un départ non prévu : le compte reste
 * actif, mais toutes ses sessions tombent immédiatement. Désactiver le compte
 * révoque aussi, mais interdit en plus toute reconnexion.
 */
export async function deconnecterUtilisateur(id: number): Promise<Utilisateur> {
  const { data } = await api.post<Utilisateur>(`/utilisateurs/${id}/deconnexion`);
  return data;
}

/**
 * `PATCH /api/utilisateurs/{id}/statut` : active ou désactive un compte.
 * Il n'y a pas de suppression : les achats et livraisons référencent leur auteur.
 * Le serveur refuse de désactiver le dernier gérant actif (409), et révoque les
 * jetons du compte qu'il désactive.
 */
export async function changerStatutUtilisateur(
  id: number,
  actif: boolean,
): Promise<Utilisateur> {
  const { data } = await api.patch<Utilisateur>(`/utilisateurs/${id}/statut`, {
    actif,
  });
  return data;
}

/**
 * `PATCH /api/utilisateurs/{id}/mot-de-passe` : pose un nouveau mot de passe
 * sur le compte d'un employé qui a perdu le sien. Réservé au gérant.
 *
 * N'exige pas l'ancien : c'est tout l'objet de l'opération. Le serveur révoque
 * les jetons du compte, et refuse que le gérant se vise lui-même — pour le
 * sien, `changerMotDePasse` demande l'actuel.
 */
export async function reinitialiserMotDePasse(
  id: number,
  nouveauMotDePasse: string,
): Promise<Utilisateur> {
  const { data } = await api.patch<Utilisateur>(
    `/utilisateurs/${id}/mot-de-passe`,
    { nouveauMotDePasse },
  );
  return data;
}
