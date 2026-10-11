package com.boutique.backend.service;

import com.boutique.backend.dto.AchatRequest;
import com.boutique.backend.dto.AnnulationRequest;
import com.boutique.backend.dto.AchatResponse;
import com.boutique.backend.dto.LigneAchatRequest;
import com.boutique.backend.dto.LigneProduit;
import com.boutique.backend.dto.PlageDeDates;
import com.boutique.backend.exception.ConflitException;
import com.boutique.backend.exception.RessourceIntrouvableException;
import com.boutique.backend.model.Achat;
import com.boutique.backend.model.LigneAchat;
import com.boutique.backend.model.Produit;
import com.boutique.backend.model.StatutAchat;
import com.boutique.backend.model.Utilisateur;
import com.boutique.backend.repository.AchatRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class AchatService {

    private final AchatRepository achatRepository;
    private final ProduitService produitService;
    private final UtilisateurService utilisateurService;
    private final NumerotationJournaliere numerotation;

    public AchatService(AchatRepository achatRepository,
                        ProduitService produitService,
                        UtilisateurService utilisateurService,
                        NumerotationJournaliere numerotation) {
        this.achatRepository = achatRepository;
        this.produitService = produitService;
        this.utilisateurService = utilisateurService;
        this.numerotation = numerotation;
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
        LigneProduit.verifierDistincts(requete.lignes());

        Achat achat = new Achat();
        achat.setDateAchat(LocalDateTime.now());
        achat.setVendeur(utilisateurService.parIdentifiant(identifiantVendeur));
        achat.setModePaiement(requete.modePaiement());
        achat.setNomClient(requete.nomClient());
        achat.setTelephoneClient(requete.telephoneClient());
        // Numéro attribué avant la boucle sur les lignes, et cet ordre porte plus
        // qu'il n'y paraît. L'incrément du compteur verrouille la ligne du jour
        // jusqu'au commit : les ventes concurrentes s'y sérialisent, et chacune
        // relit donc les produits après que la précédente a validé. Déplacer
        // cet appel après la boucle ramènerait les conflits de verrou optimiste
        // sur les produits vendus en même temps.
        achat.setNumero(numerotation.prochainNumero("ACH", LocalDate.now()));

        for (LigneAchatRequest ligne : requete.lignes()) {
            Produit produit = produitService.sortirPourVente(
                    ligne.produitId(), ligne.quantite(), achat.getVendeur(), achat.getNumero());
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

        // Résolu avant la boucle : l'auteur figure sur chaque mouvement de
        // retour, et le relire à chaque ligne n'apporterait rien.
        Utilisateur auteur = utilisateurService.parIdentifiant(identifiantAuteur);

        if (Boolean.TRUE.equals(requete.retourEnStock())) {
            for (LigneAchat ligne : achat.getLignes()) {
                // Même point d'entrée que les livraisons : le verrou optimiste
                // du produit protège des annulations concurrentes.
                produitService.retournerApresAnnulation(ligne.getProduit().getId(),
                        ligne.getQuantite(), auteur, achat.getNumero());
            }
        }

        achat.setStatut(StatutAchat.ANNULE);
        achat.setMotifAnnulation(requete.motif());
        achat.setCommentaireAnnulation(requete.commentaire());
        achat.setDateAnnulation(LocalDateTime.now());
        achat.setAnnulePar(auteur);

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
        PlageDeDates plage = PlageDeDates.de(du, au);
        return achatRepository.findByDateAchatBetween(plage.debut(), plage.fin(), pagination)
                .map(AchatResponse::de);
    }

    /**
     * Numéro de ticket du type ACH-20261003-0007, le compteur repartant chaque jour.
     * Suffisant pour une boutique où une seule caisse encaisse à la fois ; sous
     * encaissements simultanés, la contrainte d'unicité sur {@code numero}
     * rejetterait le doublon en 409.
     */
}
