package com.boutique.backend.dto;

import java.math.BigDecimal;

/**
 * Un produit et ce qu'il a rapporté sur la période.
 *
 * @param nom le nom courant du produit, pas celui figé dans la ligne de vente :
 *            le classement doit désigner la référence telle qu'elle existe
 *            aujourd'hui au catalogue
 */
public record ProduitVendu(
        Long produitId,
        String nom,
        long quantite,
        BigDecimal chiffreAffaires,
        BigDecimal marge) {
}
