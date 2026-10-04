package com.boutique.backend.dto;

import com.boutique.backend.model.LigneLivraison;
import java.math.BigDecimal;

public record LigneLivraisonResponse(
        Long produitId,
        String nomProduit,
        int quantite,
        BigDecimal prixUnitaire,
        BigDecimal montantLigne) {

    public static LigneLivraisonResponse de(LigneLivraison ligne) {
        return new LigneLivraisonResponse(
                ligne.getProduit().getId(),
                ligne.getNomProduit(),
                ligne.getQuantite(),
                ligne.getPrixUnitaire(),
                ligne.getMontantLigne());
    }
}
