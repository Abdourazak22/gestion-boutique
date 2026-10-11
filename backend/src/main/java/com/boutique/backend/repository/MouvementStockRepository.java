package com.boutique.backend.repository;

import com.boutique.backend.model.MouvementStock;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MouvementStockRepository extends JpaRepository<MouvementStock, Long> {

    /**
     * Historique d'un produit, du plus récent au plus ancien.
     *
     * <p>L'identifiant sert de second critère : les lignes d'une même vente
     * partagent l'instant de création à la microseconde près, et un tri sur la
     * seule date les rendrait dans un ordre arbitraire d'une requête à l'autre.
     *
     * <p>{@code EntityGraph} sur l'auteur : sans lui, afficher vingt mouvements
     * déclenche vingt requêtes pour vingt fois le même utilisateur.
     */
    @EntityGraph(attributePaths = "auteur")
    Page<MouvementStock> findByProduitIdOrderByCreeLeDescIdDesc(Long produitId, Pageable pagination);

    /**
     * Somme des variations enregistrées pour un produit.
     *
     * <p>Doit être égale à {@code produit.quantiteStock}. Tout écart signifie
     * qu'un chemin a modifié le stock sans passer par le journal.
     */
    @Query("select coalesce(sum(m.variation), 0) from MouvementStock m where m.produit.id = :produitId")
    int sommeVariations(@Param("produitId") Long produitId);
}
