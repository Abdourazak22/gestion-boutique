package com.boutique.backend.dto;

import java.math.BigDecimal;

/**
 * Photographie du stock à l'instant de l'appel : contrairement aux ventes et
 * aux livraisons, cet agrégat ne dépend d'aucune période.
 *
 * @param references   nombre de produits actifs au catalogue
 * @param valeurAchat  ce que le stock a coûté
 * @param valeurVente  ce qu'il rapporterait écoulé au prix courant
 * @param enAlerte     produits retombés au niveau de leur seuil
 */
public record AgregatStock(
        long references,
        BigDecimal valeurAchat,
        BigDecimal valeurVente,
        long enAlerte) {
}
