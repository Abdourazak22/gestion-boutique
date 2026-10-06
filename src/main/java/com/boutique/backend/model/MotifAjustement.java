package com.boutique.backend.model;

/**
 * Pourquoi le stock compté en rayon diffère du stock enregistré.
 *
 * <p>Une énumération et non un texte libre, pour la même raison que
 * {@link MotifAnnulation} : le gérant doit pouvoir additionner ses pertes par
 * cause. « 40 000 FCFA de casse ce mois-ci » est une information ; quarante
 * phrases libres n'en sont pas une.
 */
public enum MotifAjustement {
    /** Marchandise cassée, renversée, abîmée. */
    CASSE,
    /** Date limite dépassée, marchandise jetée. */
    PEREMPTION,
    /** Manquant sans explication matérielle : démarque inconnue, vol. */
    VOL,
    /** Le stock enregistré était faux : quantité mal saisie, vente oubliée. */
    ERREUR_SAISIE,
    /** Marchandise donnée ou consommée sur place, sans encaissement. */
    DON,
    AUTRE
}
