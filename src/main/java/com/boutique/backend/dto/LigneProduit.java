package com.boutique.backend.dto;

import com.boutique.backend.exception.ConflitException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Ligne d'une opération qui désigne un produit : ligne de vente comme ligne de
 * livraison.
 *
 * <p>N'existe que pour que la règle ci-dessous, et surtout son message, ne
 * soient écrits qu'une fois. {@code AchatService} et {@code LivraisonService}
 * la portaient mot pour mot, et deux copies d'un message destiné à
 * l'utilisateur finissent toujours par diverger.
 */
public interface LigneProduit {

    Long produitId();

    /**
     * Refuse un même produit sur deux lignes de la même opération.
     *
     * <p>Deux lignes pour un produit passeraient deux mouvements de stock
     * distincts pour une seule marchandise : le total resterait juste, le
     * détail serait faux.
     */
    static void verifierDistincts(List<? extends LigneProduit> lignes) {
        Set<Long> vus = new HashSet<>();
        for (LigneProduit ligne : lignes) {
            if (!vus.add(ligne.produitId())) {
                throw new ConflitException("Le produit " + ligne.produitId()
                        + " apparaît plusieurs fois : regroupez-le en une seule ligne");
            }
        }
    }
}
