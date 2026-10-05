package com.boutique.backend.service;

import com.boutique.backend.dto.AchatRequest;
import com.boutique.backend.dto.AnnulationRequest;
import com.boutique.backend.dto.AchatResponse;
import com.boutique.backend.dto.LigneAchatRequest;
import com.boutique.backend.exception.ConflitException;
import com.boutique.backend.exception.RessourceIntrouvableException;
import com.boutique.backend.model.Achat;
import com.boutique.backend.model.LigneAchat;
import com.boutique.backend.model.Produit;
import com.boutique.backend.model.StatutAchat;
import com.boutique.backend.repository.AchatRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class AchatService {

    private static final DateTimeFormatter JOUR = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final AchatRepository achatRepository;
    private final ProduitService produitService;
    private final UtilisateurService utilisateurService;

    public AchatService(AchatRepository achatRepository,
                        ProduitService produitService,
                        UtilisateurService utilisateurService) {
        this.achatRepository = achatRepository;
        this.produitService = produitService;
        this.utilisateurService = utilisateurService;
    }

    /**
     * Enregistre une vente : décrémente le stock de chaque produit et fige les
     * prix dans les lignes. Tout se joue dans une seule transaction, donc un
     * stock insuffisant sur la dernière ligne annule l'achat entier.
     *
     * @param identifiantVendeur identifiant de l'utilisateur connecté
     */
    @Transactional
    public AchatResponse enregistrer(AchatRequest requete, String identifiantVendeur) {
        verifierProduitsDistincts(requete.lignes());

        Achat achat = new Achat();
        achat.setDateAchat(LocalDateTime.now());
        achat.setVendeur(utilisateurService.parIdentifiant(identifiantVendeur));
        achat.setModePaiement(requete.modePaiement());
        achat.setNomClient(requete.nomClient());
        achat.setTelephoneClient(requete.telephoneClient());
        achat.setNumero(prochainNumero());

        for (LigneAchatRequest ligne : requete.lignes()) {
            Produit produit = produitService.sortirDuStock(ligne.produitId(), ligne.quantite());
            achat.ajouterLigne(LigneAchat.de(produit, ligne.quantite()));
        }
        achat.recalculerTotal();

        return AchatResponse.de(achatRepository.save(achat));
    }

    /**
     * Annule une vente et, si la marchandise revient en rayon, lui rend son stock.
     *
     * La vente n'est pas supprimée : son ticket a été remis au client et son
     * numéro ne doit jamais être réattribué. Elle quitte en revanche le chiffre
     * d'affaires et la marge, que les requêtes d'agrégation filtrent sur le
     * statut.
     *
     * @param identifiantAuteur l'annulation reste attribuable à quelqu'un
     * @throws ConflitException si la vente est déjà annulée
     */
    @Transactional
    public AchatResponse annuler(Long id, AnnulationRequest requete,
                                 String identifiantAuteur) {
        Achat achat = achatRepository.findWithLignesById(id)
                .orElseThrow(() -> RessourceIntrouvableException.de("Achat", id));

        if (achat.estAnnule()) {
            throw new ConflitException(
                    "La vente " + achat.getNumero() + " est déjà annulée");
        }

        if (Boolean.TRUE.equals(requete.retourEnStock())) {
            for (LigneAchat ligne : achat.getLignes()) {
                // Même point d'entrée que les livraisons : le verrou optimiste
                // du produit protège des annulations concurrentes.
                produitService.entrerEnStock(ligne.getProduit().getId(), ligne.getQuantite());
            }
        }

        achat.setStatut(StatutAchat.ANNULE);
        achat.setMotifAnnulation(requete.motif());
        achat.setCommentaireAnnulation(requete.commentaire());
        achat.setDateAnnulation(LocalDateTime.now());
        achat.setAnnulePar(utilisateurService.parIdentifiant(identifiantAuteur));

        return AchatResponse.de(achat);
    }

    public AchatResponse parId(Long id) {
        return AchatResponse.de(achatRepository.findWithLignesById(id)
                .orElseThrow(() -> RessourceIntrouvableException.de("Achat", id)));
    }

    /**
     * Historique des achats, du plus récent au plus ancien par défaut.
     * Les bornes {@code du} et {@code au} sont inclusives et optionnelles.
     */
    public Page<AchatResponse> historique(LocalDate du, LocalDate au, Pageable pagination) {
        if (du == null && au == null) {
            return achatRepository.findAllBy(pagination).map(AchatResponse::de);
        }
        LocalDateTime debut = du != null ? du.atStartOfDay() : LocalDate.of(1970, 1, 1).atStartOfDay();
        LocalDateTime fin = au != null ? au.atTime(23, 59, 59) : LocalDateTime.now().plusYears(100);
        if (debut.isAfter(fin)) {
            throw new ConflitException("La date de début est postérieure à la date de fin");
        }
        return achatRepository.findByDateAchatBetween(debut, fin, pagination).map(AchatResponse::de);
    }

    private void verifierProduitsDistincts(java.util.List<LigneAchatRequest> lignes) {
        Set<Long> vus = new HashSet<>();
        for (LigneAchatRequest ligne : lignes) {
            if (!vus.add(ligne.produitId())) {
                throw new ConflitException("Le produit " + ligne.produitId()
                        + " apparaît plusieurs fois : regroupez-le en une seule ligne");
            }
        }
    }

    /**
     * Numéro de ticket du type ACH-20261003-0007, le compteur repartant chaque jour.
     * Suffisant pour une boutique où une seule caisse encaisse à la fois ; sous
     * encaissements simultanés, la contrainte d'unicité sur {@code numero}
     * rejetterait le doublon en 409.
     */
    private String prochainNumero() {
        LocalDate aujourdhui = LocalDate.now();
        long rang = achatRepository.countByDateAchatBetween(
                aujourdhui.atStartOfDay(), aujourdhui.atTime(23, 59, 59)) + 1;
        return "ACH-%s-%04d".formatted(aujourdhui.format(JOUR), rang);
    }
}
