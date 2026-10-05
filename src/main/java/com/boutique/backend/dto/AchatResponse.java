package com.boutique.backend.dto;

import com.boutique.backend.model.Achat;
import com.boutique.backend.model.ModePaiement;
import com.boutique.backend.model.MotifAnnulation;
import com.boutique.backend.model.StatutAchat;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record AchatResponse(
        Long id,
        String numero,
        String nomClient,
        String telephoneClient,
        LocalDateTime dateAchat,
        String vendeur,
        ModePaiement modePaiement,
        StatutAchat statut,
        MotifAnnulation motifAnnulation,
        String commentaireAnnulation,
        LocalDateTime dateAnnulation,
        String annulePar,
        BigDecimal montantTotal,
        List<LigneAchatResponse> lignes) {

    public static AchatResponse de(Achat achat) {
        return new AchatResponse(
                achat.getId(),
                achat.getNumero(),
                achat.getNomClient(),
                achat.getTelephoneClient(),
                achat.getDateAchat(),
                achat.getVendeur().getPrenom() + " " + achat.getVendeur().getNom(),
                achat.getModePaiement(),
                achat.getStatut(),
                achat.getMotifAnnulation(),
                achat.getCommentaireAnnulation(),
                achat.getDateAnnulation(),
                achat.getAnnulePar() == null ? null
                        : achat.getAnnulePar().getPrenom() + " " + achat.getAnnulePar().getNom(),
                achat.getMontantTotal(),
                achat.getLignes().stream().map(LigneAchatResponse::de).toList());
    }
}
