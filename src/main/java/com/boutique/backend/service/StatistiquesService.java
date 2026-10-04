package com.boutique.backend.service;

import com.boutique.backend.dto.StatistiquesResponse;
import com.boutique.backend.exception.ConflitException;
import com.boutique.backend.repository.AchatRepository;
import com.boutique.backend.repository.LivraisonRepository;
import com.boutique.backend.repository.ProduitRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Agrégats du tableau de bord.
 *
 * Rien n'est calculé en mémoire : chaque chiffre vient d'une requête
 * d'agrégation, donc il porte sur toute la période et non sur une page de
 * résultats. C'est la raison d'être de ce service.
 */
@Service
@Transactional(readOnly = true)
public class StatistiquesService {

    /** Nombre de produits retenus au classement des meilleures ventes. */
    private static final int TAILLE_CLASSEMENT = 5;

    private final AchatRepository achatRepository;
    private final LivraisonRepository livraisonRepository;
    private final ProduitRepository produitRepository;

    public StatistiquesService(AchatRepository achatRepository,
                               LivraisonRepository livraisonRepository,
                               ProduitRepository produitRepository) {
        this.achatRepository = achatRepository;
        this.livraisonRepository = livraisonRepository;
        this.produitRepository = produitRepository;
    }

    /**
     * @param du bornes incluses ; absentes, la période couvre le mois en cours
     * @throws ConflitException si la date de début est postérieure à la fin
     */
    public StatistiquesResponse duTableauDeBord(LocalDate du, LocalDate au) {
        LocalDate aujourdhui = LocalDate.now();
        LocalDate debut = du != null ? du : aujourdhui.withDayOfMonth(1);
        LocalDate fin = au != null ? au : aujourdhui;

        if (debut.isAfter(fin)) {
            throw new ConflitException("La date de début est postérieure à la date de fin");
        }

        LocalDateTime deDebut = debut.atStartOfDay();
        // Borne haute inclusive : une vente de 23 h 50 appartient à sa journée.
        LocalDateTime aFin = fin.atTime(23, 59, 59);

        return new StatistiquesResponse(
                debut,
                fin,
                achatRepository.agregerVentes(deDebut, aFin),
                livraisonRepository.agregerLivraisons(deDebut, aFin),
                produitRepository.agregerStock(),
                achatRepository.ventesParJour(deDebut, aFin),
                achatRepository.meilleuresVentes(deDebut, aFin,
                        PageRequest.ofSize(TAILLE_CLASSEMENT)));
    }
}
