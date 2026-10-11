package com.boutique.backend.dto;

import com.boutique.backend.model.Produit;
import com.boutique.backend.model.UniteMesure;
import java.math.BigDecimal;

public record ProduitResponse(
        Long id,
        String nom,
        String description,
        BigDecimal prixAchat,
        BigDecimal prixVente,
        UniteMesure unite,
        int quantiteStock,
        int seuilAlerte,
        boolean enAlerteStock) {

    public static ProduitResponse de(Produit produit) {
        return new ProduitResponse(
                produit.getId(),
                produit.getNom(),
                produit.getDescription(),
                produit.getPrixAchat(),
                produit.getPrixVente(),
                produit.getUnite(),
                produit.getQuantiteStock(),
                produit.getSeuilAlerte(),
                produit.estEnAlerteStock());
    }
}
