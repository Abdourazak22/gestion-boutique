import { api } from "./api";
import type { Achat, Paginee } from "./types";

/** Une ligne de `AchatRequest` : le prix de vente est fixé par le serveur. */
export interface LigneAchatRequete {
  produitId: number;
  quantite: number;
}

export interface AchatRequete {
  nomClient?: string;
  telephoneClient?: string;
  lignes: LigneAchatRequete[];
}

export interface OptionsHistorique {
  /** Bornes incluses, au format yyyy-MM-dd attendu par le backend. */
  du?: string;
  au?: string;
  page?: number;
  size?: number;
}

/** `GET /api/achats` — historique paginé, trié du plus récent au plus ancien. */
export async function listerAchats(
  { du, au, page = 0, size = 20 }: OptionsHistorique = {},
  signal?: AbortSignal,
): Promise<Paginee<Achat>> {
  const { data } = await api.get<Paginee<Achat>>("/achats", {
    params: { du, au, page, size },
    signal,
  });
  return data;
}

export async function achatParId(id: number, signal?: AbortSignal): Promise<Achat> {
  const { data } = await api.get<Achat>(`/achats/${id}`, { signal });
  return data;
}

/**
 * `GET /api/achats/{id}/ticket` — ticket de caisse en PDF, gabarit 58 mm.
 *
 * L'endpoint exige le jeton d'authentification : impossible d'y pointer un
 * simple lien, qui ne porterait aucun en-tête. On récupère donc le PDF en
 * binaire et on l'ouvre depuis une URL d'objet locale.
 *
 * @returns la fenêtre ouverte, ou `null` si le navigateur l'a bloquée
 */
export async function ouvrirTicket(id: number): Promise<Window | null> {
  const { data } = await api.get<Blob>(`/achats/${id}/ticket`, {
    responseType: "blob",
  });

  const url = URL.createObjectURL(data);
  const fenetre = window.open(url, "_blank");
  // On ne révoque pas tout de suite : la visionneuse du navigateur lit l'URL
  // après l'appel. Une minute suffit largement, et évite la fuite mémoire.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return fenetre;
}

/**
 * `POST /api/achats` — enregistre une vente et décrémente le stock.
 * Le vendeur est déduit du jeton, jamais envoyé par le client.
 */
export async function enregistrerAchat(requete: AchatRequete): Promise<Achat> {
  const { data } = await api.post<Achat>("/achats", requete);
  return data;
}
