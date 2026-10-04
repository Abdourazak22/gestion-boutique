package com.boutique.backend.dto;

import com.boutique.backend.model.Livraison;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record LivraisonResponse(
        Long id,
        String numero,
        String nomGrossiste,
        String referenceBon,
        LocalDateTime dateLivraison,
        String receptionniste,
        BigDecimal montantTotal,
        List<LigneLivraisonResponse> lignes) {

    public static LivraisonResponse de(Livraison livraison) {
        return new LivraisonResponse(
                livraison.getId(),
                livraison.getNumero(),
                livraison.getNomGrossiste(),
                livraison.getReferenceBon(),
                livraison.getDateLivraison(),
                livraison.getReceptionniste().getPrenom() + " "
                        + livraison.getReceptionniste().getNom(),
                livraison.getMontantTotal(),
                livraison.getLignes().stream().map(LigneLivraisonResponse::de).toList());
    }
}
