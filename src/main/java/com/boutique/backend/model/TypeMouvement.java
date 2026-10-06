package com.boutique.backend.model;

/**
 * Nature d'un mouvement de stock.
 *
 * <p>Toute variation du stock d'un produit passe par l'un de ces cinq cas et
 * laisse une ligne dans le journal. Il n'existe plus de chemin qui écrit le
 * stock sans dire pourquoi.
 */
public enum TypeMouvement {
    /** Stock saisi à la création du produit, ou repris lors d'une remise au catalogue. */
    INITIAL,
    /** Réception d'une livraison du grossiste. */
    ENTREE,
    /** Vente à un client. */
    SORTIE,
    /** Retour en rayon après annulation d'une vente. */
    RETOUR,
    /** Correction après comptage physique : c'est l'inventaire. */
    AJUSTEMENT
}
