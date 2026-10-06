import { api } from "./api";
import type { Livraison, Paginee } from "./types";
import type { OptionsHistorique } from "./achats";

export interface LigneLivraisonRequete {
  produitId: number;
  quantite: number;
  /** Absent, le serveur reprend le prix d'achat courant du produit. */
  prixUnitaire?: number;
}

export interface LivraisonRequete {
  nomGrossiste: string;
  referenceBon?: string;
  lignes: LigneLivraisonRequete[];
}

/** `GET /api/livraisons` : historique paginé des réceptions grossistes. */
export async function listerLivraisons(
  { du, au, page = 0, size = 20 }: OptionsHistorique = {},
  signal?: AbortSignal,
): Promise<Paginee<Livraison>> {
  const { data } = await api.get<Paginee<Livraison>>("/livraisons", {
    params: { du, au, page, size },
    signal,
  });
  return data;
}

/** `POST /api/livraisons` : entrée en stock, réservée au rôle GERANT. */
export async function enregistrerLivraison(
  requete: LivraisonRequete,
): Promise<Livraison> {
  const { data } = await api.post<Livraison>("/livraisons", requete);
  return data;
}
