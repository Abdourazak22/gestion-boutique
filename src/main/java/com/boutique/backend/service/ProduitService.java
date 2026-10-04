package com.boutique.backend.service;

import com.boutique.backend.dto.ProduitRequest;
import com.boutique.backend.dto.ProduitResponse;
import com.boutique.backend.exception.ConflitException;
import com.boutique.backend.exception.RessourceIntrouvableException;
import com.boutique.backend.model.Produit;
import com.boutique.backend.repository.ProduitRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@Transactional(readOnly = true)
public class ProduitService {

    private final ProduitRepository produitRepository;

    public ProduitService(ProduitRepository produitRepository) {
        this.produitRepository = produitRepository;
    }

    /**
     * Enregistre un produit. Si un produit du même nom a été supprimé
     * logiquement, il est remis au catalogue avec les nouvelles valeurs plutôt
     * que refusé : sinon un nom supprimé par erreur serait bloqué définitivement
     * par la contrainte d'unicité.
     */
    @Transactional
    public ProduitResponse creer(ProduitRequest requete) {
        verifierCoherencePrix(requete);

        Produit existant = produitRepository.findByNomIgnoreCase(requete.nom().trim()).orElse(null);
        if (existant != null && existant.isActif()) {
            throw new ConflitException("Un produit nommé « " + requete.nom() + " » existe déjà");
        }

        Produit produit = existant != null ? existant : new Produit();
        produit.setActif(true);
        appliquer(requete, produit);

        return ProduitResponse.de(produitRepository.save(produit));
    }

    @Transactional
    public ProduitResponse modifier(Long id, ProduitRequest requete) {
        Produit produit = parIdOuErreur(id);

        // Volontairement strict, y compris face a un produit supprime logiquement :
        // le nom reste unique en base, un renommage ne peut pas le reutiliser.
        if (produitRepository.existsByNomIgnoreCaseAndIdNot(requete.nom().trim(), id)) {
            throw new ConflitException("Un autre produit porte déjà le nom « " + requete.nom() + " »");
        }
        verifierCoherencePrix(requete);
        appliquer(requete, produit);

        return ProduitResponse.de(produit);
    }

    private void appliquer(ProduitRequest requete, Produit produit) {
        produit.setNom(requete.nom().trim());
        produit.setDescription(requete.description());
        produit.setPrixAchat(requete.prixAchat());
        produit.setPrixVente(requete.prixVente());
        produit.setUnite(requete.unite());
        produit.setQuantiteStock(requete.quantiteStock());
        produit.setSeuilAlerte(requete.seuilAlerte());
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

    /**
     * Sort {@code quantite} unités du stock et renvoie le produit à jour.
     * Point d'entrée unique des sorties de stock, utilisé par les ventes.
     *
     * @throws ConflitException si le stock disponible est insuffisant
     */
    @Transactional
    public Produit sortirDuStock(Long produitId, int quantite) {
        Produit produit = parIdOuErreur(produitId);
        if (produit.getQuantiteStock() < quantite) {
            throw new ConflitException(("Stock insuffisant pour « %s » : %d en stock, "
                    + "%d demandés").formatted(produit.getNom(), produit.getQuantiteStock(), quantite));
        }
        produit.setQuantiteStock(produit.getQuantiteStock() - quantite);
        return produit;
    }

    /**
     * Entre {@code quantite} unités en stock et renvoie le produit à jour.
     * Point d'entrée unique des entrées de stock, utilisé par les livraisons.
     */
    @Transactional
    public Produit entrerEnStock(Long produitId, int quantite) {
        Produit produit = parIdOuErreur(produitId);
        produit.setQuantiteStock(produit.getQuantiteStock() + quantite);
        return produit;
    }

    private Produit parIdOuErreur(Long id) {
        return produitRepository.findByIdAndActifTrue(id)
                .orElseThrow(() -> RessourceIntrouvableException.de("Produit", id));
    }

    private void verifierCoherencePrix(ProduitRequest requete) {
        if (requete.prixVente().compareTo(requete.prixAchat()) < 0) {
            throw new ConflitException(
                    "Le prix de vente ne peut être inférieur au prix d'achat");
        }
    }
}
