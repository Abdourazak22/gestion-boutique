package com.boutique.backend.dto;

import com.boutique.backend.model.LigneAchat;
import java.math.BigDecimal;

public record LigneAchatResponse(
        Long produitId,
        String nomProduit,
        int quantite,
        BigDecimal prixUnitaire,
        BigDecimal montantLigne) {

    public static LigneAchatResponse de(LigneAchat ligne) {
        return new LigneAchatResponse(
                ligne.getProduit().getId(),
                ligne.getNomProduit(),
                ligne.getQuantite(),
                ligne.getPrixUnitaire(),
                ligne.getMontantLigne());
    }
}
