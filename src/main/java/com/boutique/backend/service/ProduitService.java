package com.boutique.backend.service;

import com.boutique.backend.dto.AjustementStockRequest;
import com.boutique.backend.dto.ChampsProduit;
import com.boutique.backend.dto.MouvementStockResponse;
import com.boutique.backend.dto.ProduitRequest;
import com.boutique.backend.dto.ProduitResponse;
import com.boutique.backend.dto.ProduitUpdateRequest;
import com.boutique.backend.exception.ConflitException;
import com.boutique.backend.exception.RequeteInvalideException;
import com.boutique.backend.exception.RessourceIntrouvableException;
import com.boutique.backend.model.MotifAjustement;
import com.boutique.backend.model.MouvementStock;
import com.boutique.backend.model.Produit;
import com.boutique.backend.model.TypeMouvement;
import com.boutique.backend.model.Utilisateur;
import com.boutique.backend.repository.MouvementStockRepository;
import com.boutique.backend.repository.ProduitRepository;
import java.math.BigDecimal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Catalogue et stock.
 *
 * <p>Règle centrale : le stock d'un produit ne se modifie que par
 * {@link #journaliser}, qui écrit la nouvelle quantité et la ligne de journal
 * correspondante dans la même transaction. Aucun autre chemin ne touche à
 * {@code quantiteStock}, ce qui garantit que la somme des variations d'un
 * produit reste égale à son stock.
 */
@Service
@Transactional(readOnly = true)
public class ProduitService {

    private final ProduitRepository produitRepository;
    private final MouvementStockRepository mouvementStockRepository;
    private final UtilisateurService utilisateurService;

    public ProduitService(ProduitRepository produitRepository,
                          MouvementStockRepository mouvementStockRepository,
                          UtilisateurService utilisateurService) {
        this.produitRepository = produitRepository;
        this.mouvementStockRepository = mouvementStockRepository;
        this.utilisateurService = utilisateurService;
    }

    /**
     * Enregistre un produit. Si un produit du même nom a été supprimé
     * logiquement, il est remis au catalogue avec les nouvelles valeurs plutôt
     * que refusé : sinon un nom supprimé par erreur serait bloqué définitivement
     * par la contrainte d'unicité.
     */
    @Transactional
    public ProduitResponse creer(ProduitRequest requete, String identifiantAuteur) {
        verifierCoherencePrix(requete.prixAchat(), requete.prixVente());

        Produit existant = produitRepository.findByNomIgnoreCase(requete.nom().trim()).orElse(null);
        if (existant != null && existant.isActif()) {
            throw new ConflitException("Un produit nommé « " + requete.nom() + " » existe déjà");
        }

        Produit produit = existant != null ? existant : new Produit();
        produit.setActif(true);
        appliquer(requete, produit);

        Produit enregistre = produitRepository.save(produit);

        // Le stock demandé est atteint par un mouvement, et non par une
        // affectation directe. La nuance compte pour un produit remis au
        // catalogue : il conserve son stock et son historique, donc écrire la
        // valeur absolue romprait l'égalité entre la somme des variations et le
        // stock. La soustraction donne la bonne variation dans les deux cas,
        // puisqu'un produit neuf part de zéro.
        int variation = requete.quantiteStock() - enregistre.getQuantiteStock();
        if (variation != 0) {
            journaliser(enregistre, TypeMouvement.INITIAL, variation, null,
                    existant != null
                            ? "Stock ajusté lors de la remise au catalogue"
                            : "Stock initial saisi à la création du produit",
                    utilisateurService.parIdentifiant(identifiantAuteur), null);
        }

        return ProduitResponse.de(enregistre);
    }

    /**
     * Modifie la fiche d'un produit. Ne touche pas au stock : la requête ne le
     * transporte plus, voir {@link ProduitUpdateRequest} pour la raison.
     */
    @Transactional
    public ProduitResponse modifier(Long id, ProduitUpdateRequest requete) {
        Produit produit = parIdOuErreur(id);

        // Volontairement strict, y compris face a un produit supprime logiquement :
        // le nom reste unique en base, un renommage ne peut pas le reutiliser.
        if (produitRepository.existsByNomIgnoreCaseAndIdNot(requete.nom().trim(), id)) {
            throw new ConflitException("Un autre produit porte déjà le nom « " + requete.nom() + " »");
        }
        verifierCoherencePrix(requete.prixAchat(), requete.prixVente());
        appliquer(requete, produit);

        return ProduitResponse.de(produit);
    }

    public ProduitResponse parId(Long id) {
        return ProduitResponse.de(parIdOuErreur(id));
    }

    /**
     * Liste paginée des produits actifs. Si {@code nom} est renseigné, filtre sur
     * les noms contenant cette chaîne (insensible à la casse).
     */
    public Page<ProduitResponse> rechercher(String nom, Pageable pagination) {
        Page<Produit> produits = StringUtils.hasText(nom)
                ? produitRepository.findByActifTrueAndNomContainingIgnoreCase(nom.trim(), pagination)
                : produitRepository.findByActifTrue(pagination);
        return produits.map(ProduitResponse::de);
    }

    /** Produits dont le stock est retombé au niveau du seuil d'alerte. */
    public Page<ProduitResponse> enAlerteStock(Pageable pagination) {
        return produitRepository.findEnAlerteStock(pagination).map(ProduitResponse::de);
    }

    /**
     * Suppression logique : le produit disparaît du catalogue mais reste lié aux
     * achats et livraisons déjà enregistrés.
     */
    @Transactional
    public void supprimer(Long id) {
        parIdOuErreur(id).setActif(false);
    }

    // --- Mouvements de stock ------------------------------------------------

    /**
     * Sort {@code quantite} unités pour une vente.
     *
     * @throws ConflitException si le stock disponible est insuffisant
     */
    @Transactional
    public Produit sortirPourVente(Long produitId, int quantite, Utilisateur vendeur, String numeroVente) {
        Produit produit = parIdOuErreur(produitId);
        if (produit.getQuantiteStock() < quantite) {
            throw new ConflitException(("Stock insuffisant pour « %s » : %d en stock, "
                    + "%d demandés").formatted(produit.getNom(), produit.getQuantiteStock(), quantite));
        }
        journaliser(produit, TypeMouvement.SORTIE, -quantite, null, null, vendeur, numeroVente);
        return produit;
    }

    /** Entre {@code quantite} unités reçues du grossiste. */
    @Transactional
    public Produit entrerParLivraison(Long produitId, int quantite, Utilisateur receptionniste,
                                      String numeroLivraison) {
        Produit produit = parIdOuErreur(produitId);
        journaliser(produit, TypeMouvement.ENTREE, quantite, null, null,
                receptionniste, numeroLivraison);
        return produit;
    }

    /** Remet en rayon la marchandise d'une vente annulée. */
    @Transactional
    public Produit retournerApresAnnulation(Long produitId, int quantite, Utilisateur auteur,
                                            String numeroVente) {
        Produit produit = parIdOuErreur(produitId);
        journaliser(produit, TypeMouvement.RETOUR, quantite, null, null, auteur, numeroVente);
        return produit;
    }

    /**
     * Aligne le stock enregistré sur le stock compté en rayon : l'inventaire.
     *
     * <p>Un comptage conforme est enregistré lui aussi, avec une variation
     * nulle. Savoir qu'un produit a été compté et vérifié tel jour a de la
     * valeur, et n'exige aucun motif. Un écart, lui, doit être justifié.
     */
    @Transactional
    public ProduitResponse ajuster(Long id, AjustementStockRequest requete, String identifiantAuteur) {
        Produit produit = parIdOuErreur(id);

        int variation = requete.quantiteComptee() - produit.getQuantiteStock();
        if (variation != 0 && requete.motif() == null) {
            throw RequeteInvalideException.surChamp("motif",
                    "Un motif est obligatoire pour justifier un écart de stock");
        }

        journaliser(produit, TypeMouvement.AJUSTEMENT, variation, requete.motif(),
                requete.commentaire(), utilisateurService.parIdentifiant(identifiantAuteur), null);

        return ProduitResponse.de(produit);
    }

    /** Historique des mouvements d'un produit, du plus récent au plus ancien. */
    public Page<MouvementStockResponse> mouvements(Long produitId, Pageable pagination) {
        // Produit inconnu ou retiré du catalogue : 404, comme partout ailleurs.
        parIdOuErreur(produitId);
        return mouvementStockRepository
                .findByProduitIdOrderByCreeLeDescIdDesc(produitId, pagination)
                .map(MouvementStockResponse::de);
    }

    /**
     * Seul point d'écriture du stock. Applique la variation et enregistre la
     * ligne de journal correspondante dans la même transaction, pour que l'une
     * ne puisse pas exister sans l'autre.
     */
    private void journaliser(Produit produit, TypeMouvement type, int variation,
                             MotifAjustement motif, String commentaire,
                             Utilisateur auteur, String reference) {
        int avant = produit.getQuantiteStock();
        int apres = avant + variation;

        // Garde-fou : les appelants vérifient déjà ce qui les concerne, mais un
        // stock négatif en base n'a aucun sens et ne doit pas pouvoir y entrer
        // par un chemin qu'on aurait oublié.
        if (apres < 0) {
            throw new ConflitException(("Mouvement refusé sur « %s » : le stock passerait à %d")
                    .formatted(produit.getNom(), apres));
        }

        produit.setQuantiteStock(apres);

        mouvementStockRepository.save(MouvementStock.builder()
                .produit(produit)
                .type(type)
                .variation(variation)
                .stockAvant(avant)
                .stockApres(apres)
                .motif(motif)
                .commentaire(commentaire)
                .auteur(auteur)
                .reference(reference)
                .build());
    }

    /**
     * Recopie les champs communs à la création et à la modification. Le stock
     * n'en fait pas partie : il ne bouge que par {@link #journaliser}.
     */
    private void appliquer(ChampsProduit requete, Produit produit) {
        produit.setNom(requete.nom().trim());
        produit.setDescription(requete.description());
        produit.setPrixAchat(requete.prixAchat());
        produit.setPrixVente(requete.prixVente());
        produit.setUnite(requete.unite());
        produit.setSeuilAlerte(requete.seuilAlerte());
    }

    private Produit parIdOuErreur(Long id) {
        return produitRepository.findByIdAndActifTrue(id)
                .orElseThrow(() -> RessourceIntrouvableException.de("Produit", id));
    }

    private void verifierCoherencePrix(BigDecimal prixAchat, BigDecimal prixVente) {
        if (prixVente.compareTo(prixAchat) < 0) {
            throw new ConflitException(
                    "Le prix de vente ne peut être inférieur au prix d'achat");
        }
    }
}
