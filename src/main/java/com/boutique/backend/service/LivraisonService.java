package com.boutique.backend.service;

import com.boutique.backend.dto.LigneLivraisonRequest;
import com.boutique.backend.dto.LivraisonRequest;
import com.boutique.backend.dto.LivraisonResponse;
import com.boutique.backend.exception.ConflitException;
import com.boutique.backend.exception.RessourceIntrouvableException;
import com.boutique.backend.model.LigneLivraison;
import com.boutique.backend.model.Livraison;
import com.boutique.backend.model.Produit;
import com.boutique.backend.repository.LivraisonRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class LivraisonService {

    private static final DateTimeFormatter JOUR = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final LivraisonRepository livraisonRepository;
    private final ProduitService produitService;
    private final UtilisateurService utilisateurService;

    public LivraisonService(LivraisonRepository livraisonRepository,
                            ProduitService produitService,
                            UtilisateurService utilisateurService) {
        this.livraisonRepository = livraisonRepository;
        this.produitService = produitService;
        this.utilisateurService = utilisateurService;
    }

    /**
     * Enregistre une réception de marchandise : incrémente le stock de chaque
     * produit livré et conserve le prix payé au grossiste sur la ligne.
     *
     * @param identifiantReceptionniste identifiant de l'utilisateur connecté
     */
    @Transactional
    public LivraisonResponse enregistrer(LivraisonRequest requete,
                                         String identifiantReceptionniste) {
        verifierProduitsDistincts(requete.lignes());

        Livraison livraison = new Livraison();
        livraison.setDateLivraison(LocalDateTime.now());
        livraison.setReceptionniste(utilisateurService.parIdentifiant(identifiantReceptionniste));
        livraison.setNomGrossiste(requete.nomGrossiste().trim());
        livraison.setReferenceBon(requete.referenceBon());
        livraison.setNumero(prochainNumero());

        for (LigneLivraisonRequest ligne : requete.lignes()) {
            Produit produit = produitService.entrerEnStock(ligne.produitId(), ligne.quantite());
            BigDecimal prix = ligne.prixUnitaire() != null
                    ? ligne.prixUnitaire()
                    : produit.getPrixAchat();
            livraison.ajouterLigne(LigneLivraison.de(produit, ligne.quantite(), prix));
        }
        livraison.recalculerTotal();

        return LivraisonResponse.de(livraisonRepository.save(livraison));
    }

    public LivraisonResponse parId(Long id) {
        return LivraisonResponse.de(livraisonRepository.findWithLignesById(id)
                .orElseThrow(() -> RessourceIntrouvableException.de("Livraison", id)));
    }

    /** Historique des livraisons. Bornes inclusives et optionnelles. */
    public Page<LivraisonResponse> historique(LocalDate du, LocalDate au, Pageable pagination) {
        if (du == null && au == null) {
            return livraisonRepository.findAllBy(pagination).map(LivraisonResponse::de);
        }
        LocalDateTime debut = du != null ? du.atStartOfDay() : LocalDate.of(1970, 1, 1).atStartOfDay();
        LocalDateTime fin = au != null ? au.atTime(23, 59, 59) : LocalDateTime.now().plusYears(100);
        if (debut.isAfter(fin)) {
            throw new ConflitException("La date de début est postérieure à la date de fin");
        }
        return livraisonRepository.findByDateLivraisonBetween(debut, fin, pagination)
                .map(LivraisonResponse::de);
    }

    private void verifierProduitsDistincts(List<LigneLivraisonRequest> lignes) {
        Set<Long> vus = new HashSet<>();
        for (LigneLivraisonRequest ligne : lignes) {
            if (!vus.add(ligne.produitId())) {
                throw new ConflitException("Le produit " + ligne.produitId()
                        + " apparaît plusieurs fois : regroupez-le en une seule ligne");
            }
        }
    }

    /** Numéro de bon du type LIV-20261003-0003, compteur quotidien. */
    private String prochainNumero() {
        LocalDate aujourdhui = LocalDate.now();
        long rang = livraisonRepository.countByDateLivraisonBetween(
                aujourdhui.atStartOfDay(), aujourdhui.atTime(23, 59, 59)) + 1;
        return "LIV-%s-%04d".formatted(aujourdhui.format(JOUR), rang);
    }
}
