package com.boutique.backend.model;

/**
 * Pourquoi une vente a été annulée.
 *
 * <p>Une énumération plutôt qu'un texte libre : le gérant doit pouvoir compter
 * les erreurs de saisie de ses vendeurs, ce qu'une phrase ne permet pas. Le
 * commentaire libre reste disponible à côté pour le détail.
 */
public enum MotifAnnulation {
    /** Mauvais produit, mauvaise quantité, double encaissement. */
    ERREUR_SAISIE,
    /** Le client rapporte la marchandise intacte. */
    RETOUR_CLIENT,
    /** Marchandise abîmée ou périmée : elle ne retourne pas en rayon. */
    PRODUIT_DEFECTUEUX,
    AUTRE
}
