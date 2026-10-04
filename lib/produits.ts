import { api } from "./api";
import type { Paginee, Produit, UniteMesure } from "./types";

/** Corps attendu par `POST`/`PUT /api/produits` (`ProduitRequest`). */
export interface ProduitRequete {
  nom: string;
  description?: string | null;
  prixAchat: number;
  prixVente: number;
  unite: UniteMesure;
  quantiteStock: number;
  seuilAlerte: number;
}

export interface OptionsCatalogue {
  /** Recherche serveur sur le nom, insensible à la casse. */
  nom?: string;
  page?: number;
  size?: number;
}

/** `GET /api/produits` — catalogue paginé des produits actifs. */
export async function listerProduits(
  { nom, page = 0, size = 20 }: OptionsCatalogue = {},
  signal?: AbortSignal,
): Promise<Paginee<Produit>> {
  const { data } = await api.get<Paginee<Produit>>("/produits", {
    // `nom` vide est omis : le backend ne filtre que sur une chaîne non vide.
    params: { nom: nom?.trim() || undefined, page, size },
    signal,
  });
  return data;
}

/** `GET /api/produits/alertes-stock` — produits retombés au seuil d'alerte. */
export async function listerAlertesStock(
  { page = 0, size = 20 } = {},
  signal?: AbortSignal,
): Promise<Paginee<Produit>> {
  const { data } = await api.get<Paginee<Produit>>("/produits/alertes-stock", {
    params: { page, size },
    signal,
  });
  return data;
}

export async function produitParId(id: number, signal?: AbortSignal): Promise<Produit> {
  const { data } = await api.get<Produit>(`/produits/${id}`, { signal });
  return data;
}

/** `POST /api/produits` — réservé au rôle GERANT. */
export async function creerProduit(requete: ProduitRequete): Promise<Produit> {
  const { data } = await api.post<Produit>("/produits", requete);
  return data;
}

/** `PUT /api/produits/{id}` — réservé au rôle GERANT. */
export async function modifierProduit(
  id: number,
  requete: ProduitRequete,
): Promise<Produit> {
  const { data } = await api.put<Produit>(`/produits/${id}`, requete);
  return data;
}

/** `DELETE /api/produits/{id}` — suppression logique, réservée au GERANT. */
export async function supprimerProduit(id: number): Promise<void> {
  await api.delete(`/produits/${id}`);
}
