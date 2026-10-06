package com.boutique.backend.service;

import com.boutique.backend.dto.LigneLivraisonRequest;
import com.boutique.backend.dto.LigneProduit;
import com.boutique.backend.dto.LivraisonRequest;
import com.boutique.backend.dto.LivraisonResponse;
import com.boutique.backend.dto.PlageDeDates;
import com.boutique.backend.exception.RessourceIntrouvableException;
import com.boutique.backend.model.LigneLivraison;
import com.boutique.backend.model.Livraison;
import com.boutique.backend.model.Produit;
import com.boutique.backend.repository.LivraisonRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
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
        LigneProduit.verifierDistincts(requete.lignes());

        Livraison livraison = new Livraison();
        livraison.setDateLivraison(LocalDateTime.now());
        livraison.setReceptionniste(utilisateurService.parIdentifiant(identifiantReceptionniste));
        livraison.setNomGrossiste(requete.nomGrossiste().trim());
        livraison.setReferenceBon(requete.referenceBon());
        livraison.setNumero(prochainNumero());

        for (LigneLivraisonRequest ligne : requete.lignes()) {
            Produit produit = produitService.entrerParLivraison(ligne.produitId(),
                    ligne.quantite(), livraison.getReceptionniste(), livraison.getNumero());
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
        PlageDeDates plage = PlageDeDates.de(du, au);
        return livraisonRepository.findByDateLivraisonBetween(plage.debut(), plage.fin(), pagination)
                .map(LivraisonResponse::de);
    }

    /** Numéro de bon du type LIV-20261003-0003, compteur quotidien. */
    private String prochainNumero() {
        LocalDate aujourdhui = LocalDate.now();
        PlageDeDates jour = PlageDeDates.journee(aujourdhui);
        long rang = livraisonRepository.countByDateLivraisonBetween(jour.debut(), jour.fin()) + 1;
        return "LIV-%s-%04d".formatted(aujourdhui.format(JOUR), rang);
    }
}
