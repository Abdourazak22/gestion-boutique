package com.boutique.backend.model;

/**
 * État d'une vente.
 *
 * <p>Il n'y a volontairement pas de statut « remboursé » distinct d'« annulé » :
 * les deux rendent l'argent et sortent la vente du chiffre d'affaires, donc le
 * code les traiterait de façon identique. Ce qui diffère est la <i>raison</i>,
 * portée par {@link MotifAnnulation} — une information qui, elle, s'agrège.
 */
public enum StatutAchat {
    PAYE,
    ANNULE
}
