import { api } from "./api";
import type {
  MotifAjustement,
  MouvementStock,
  Paginee,
  Produit,
  UniteMesure,
} from "./types";

/** Corps attendu par `POST /api/produits` (`ProduitRequest`). */
export interface ProduitRequete {
  nom: string;
  description?: string | null;
  prixAchat: number;
  prixVente: number;
  unite: UniteMesure;
  /** Stock de départ, inscrit au journal comme premier mouvement du produit. */
  quantiteStock: number;
  seuilAlerte: number;
}

/**
 * Corps attendu par `PUT /api/produits/{id}` (`ProduitUpdateRequest`).
 *
 * Sans `quantiteStock`, et ce n'est pas un oubli : le serveur refuse ce champ
 * en 400. Il l'acceptait, et l'écrivait en valeur absolue, ce qui effaçait du
 * stock toute vente enregistrée depuis l'ouverture du formulaire. Le stock se
 * corrige par `ajusterStock`.
 */
export type ProduitModificationRequete = Omit<ProduitRequete, "quantiteStock">;

/** Corps attendu par `PATCH /api/produits/{id}/ajustement`. */
export interface AjustementRequete {
  /** Ce qui a réellement été compté en rayon. Le serveur en déduit l'écart. */
  quantiteComptee: number;
  /** Obligatoire seulement s'il y a un écart à justifier. */
  motif?: MotifAjustement | null;
  commentaire?: string | null;
}

export interface OptionsCatalogue {
  /** Recherche serveur sur le nom, insensible à la casse. */
  nom?: string;
  page?: number;
  size?: number;
}

/** `GET /api/produits` : catalogue paginé des produits actifs. */
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

/** `GET /api/produits/alertes-stock` : produits retombés au seuil d'alerte. */
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

/** `POST /api/produits` : réservé au rôle GERANT. */
export async function creerProduit(requete: ProduitRequete): Promise<Produit> {
  const { data } = await api.post<Produit>("/produits", requete);
  return data;
}

/** `PUT /api/produits/{id}` : réservé au rôle GERANT. Ne touche pas au stock. */
export async function modifierProduit(
  id: number,
  requete: ProduitModificationRequete,
): Promise<Produit> {
  const { data } = await api.put<Produit>(`/produits/${id}`, requete);
  return data;
}

/**
 * `PATCH /api/produits/{id}/ajustement` : aligne le stock enregistré sur le
 * stock compté en rayon. Réservé au rôle GERANT.
 */
export async function ajusterStock(
  id: number,
  requete: AjustementRequete,
): Promise<Produit> {
  const { data } = await api.patch<Produit>(`/produits/${id}/ajustement`, requete);
  return data;
}

/**
 * `GET /api/produits/{id}/mouvements` : journal de stock du produit, du plus
 * récent au plus ancien. Réservé au rôle GERANT.
 */
export async function listerMouvements(
  id: number,
  { page = 0, size = 10 } = {},
  signal?: AbortSignal,
): Promise<Paginee<MouvementStock>> {
  const { data } = await api.get<Paginee<MouvementStock>>(
    `/produits/${id}/mouvements`,
    { params: { page, size }, signal },
  );
  return data;
}

/** `DELETE /api/produits/{id}` : suppression logique, réservée au GERANT. */
export async function supprimerProduit(id: number): Promise<void> {
  await api.delete(`/produits/${id}`);
}
