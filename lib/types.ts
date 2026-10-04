/**
 * Contrat de l'API Spring, transcrit depuis `com.boutique.backend.dto` et
 * `com.boutique.backend.model`.
 *
 * Rien ici n'est inventé : chaque champ existe dans une réponse du backend.
 * Les enums sont en majuscules comme Jackson les sérialise, et les montants
 * arrivent en `BigDecimal` côté Java, donc en nombre JSON côté client.
 */

export type Role = "GERANT" | "VENDEUR";

export type Sexe = "MASCULIN" | "FEMININ";

export type UniteMesure =
  | "PIECE"
  | "KILOGRAMME"
  | "LITRE"
  | "PAQUET"
  | "SACHET"
  | "CARTON";

/** `UtilisateurResponse` */
export interface Utilisateur {
  id: number;
  nom: string;
  prenom: string;
  matricule: string;
  sexe: Sexe;
  dateNaissance: string; // ISO yyyy-MM-dd
  identifiant: string;
  role: Role;
  actif: boolean;
}

/** `ProduitResponse` */
export interface Produit {
  id: number;
  nom: string;
  description: string | null;
  prixAchat: number;
  prixVente: number;
  unite: UniteMesure;
  quantiteStock: number;
  seuilAlerte: number;
  /** Calculé par le serveur : `quantiteStock <= seuilAlerte`. */
  enAlerteStock: boolean;
}

/** `LigneAchatResponse` et `LigneLivraisonResponse` ont la même forme. */
export interface Ligne {
  produitId: number;
  nomProduit: string;
  quantite: number;
  prixUnitaire: number;
  montantLigne: number;
}

/** `AchatResponse` */
export interface Achat {
  id: number;
  numero: string;
  nomClient: string | null;
  telephoneClient: string | null;
  /** `LocalDateTime` sans fuseau : lue comme heure locale du navigateur. */
  dateAchat: string;
  /** Prénom et nom du vendeur, déjà composés par le serveur. */
  vendeur: string;
  montantTotal: number;
  lignes: Ligne[];
}

/** `LivraisonResponse` */
export interface Livraison {
  id: number;
  numero: string;
  nomGrossiste: string;
  referenceBon: string | null;
  dateLivraison: string;
  receptionniste: string;
  montantTotal: number;
  lignes: Ligne[];
}

/**
 * Forme de `org.springframework.data.web.PagedModel`, vérifiée sur l'API :
 * le contenu et les métadonnées de pagination, sans les liens HATEOAS.
 */
export interface Paginee<T> {
  content: T[];
  page: {
    size: number;
    number: number;
    totalElements: number;
    totalPages: number;
  };
}

/* --- Agrégats du tableau de bord (`GET /api/statistiques`) --------------- */

/** Le panier moyen et le taux de marge se déduisent de ces trois nombres. */
export interface AgregatVentes {
  nombre: number;
  chiffreAffaires: number;
  marge: number;
}

export interface AgregatLivraisons {
  nombre: number;
  montantTotal: number;
}

/** Photographie du stock : ne dépend pas de la période demandée. */
export interface AgregatStock {
  references: number;
  valeurAchat: number;
  valeurVente: number;
  enAlerte: number;
}

/** Seules les journées ayant vendu sont renvoyées : au client de combler les creux. */
export interface VenteParJour {
  jour: string; // ISO yyyy-MM-dd
  nombre: number;
  montant: number;
}

export interface ProduitVendu {
  produitId: number;
  nom: string;
  quantite: number;
  chiffreAffaires: number;
  marge: number;
}

export interface Statistiques {
  du: string;
  au: string;
  ventes: AgregatVentes;
  livraisons: AgregatLivraisons;
  stock: AgregatStock;
  ventesParJour: VenteParJour[];
  meilleuresVentes: ProduitVendu[];
}

/** Panier moyen : rien à afficher si aucune vente n'a eu lieu. */
export const panierMoyen = (v: AgregatVentes): number =>
  v.nombre === 0 ? 0 : v.chiffreAffaires / v.nombre;

/** Part de marge dans le chiffre d'affaires, en pourcentage. */
export const tauxMarge = (v: AgregatVentes): number =>
  v.chiffreAffaires === 0 ? 0 : (v.marge / v.chiffreAffaires) * 100;

export const libelleUnite: Record<UniteMesure, string> = {
  PIECE: "pièce",
  KILOGRAMME: "kg",
  LITRE: "L",
  PAQUET: "paquet",
  SACHET: "sachet",
  CARTON: "carton",
};

export const UNITES = Object.keys(libelleUnite) as UniteMesure[];

export const libelleSexe = (sexe: Sexe): string =>
  sexe === "FEMININ" ? "Féminin" : "Masculin";

/** Libellé accordé au sexe, comme l'affiche la maquette (« Gérante »). */
export function libelleRole({ role, sexe }: Pick<Utilisateur, "role" | "sexe">): string {
  const feminin = sexe === "FEMININ";
  if (role === "GERANT") return feminin ? "Gérante" : "Gérant";
  return feminin ? "Vendeuse" : "Vendeur";
}

export const nomComplet = (u: Pick<Utilisateur, "nom" | "prenom">): string =>
  `${u.prenom} ${u.nom}`;

/** Marge commerciale en pourcentage du prix de vente. */
export const marge = (p: Pick<Produit, "prixAchat" | "prixVente">): number =>
  p.prixVente === 0 ? 0 : ((p.prixVente - p.prixAchat) / p.prixVente) * 100;
