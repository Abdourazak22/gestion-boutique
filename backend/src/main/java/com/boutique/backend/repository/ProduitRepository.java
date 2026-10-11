package com.boutique.backend.repository;

import com.boutique.backend.dto.AgregatStock;
import com.boutique.backend.model.Produit;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ProduitRepository extends JpaRepository<Produit, Long> {

    Optional<Produit> findByIdAndActifTrue(Long id);

    Page<Produit> findByActifTrue(Pageable pageable);

    /** Recherche par nom, insensible à la casse et aux accents absents de la saisie. */
    Page<Produit> findByActifTrueAndNomContainingIgnoreCase(String nom, Pageable pageable);

    /** Cherche sans filtrer sur actif : le nom reste unique en base, meme supprime. */
    Optional<Produit> findByNomIgnoreCase(String nom);

    boolean existsByNomIgnoreCaseAndIdNot(String nom, Long id);

    @Query("select p from Produit p where p.actif = true and p.quantiteStock <= p.seuilAlerte")
    Page<Produit> findEnAlerteStock(Pageable pageable);

    /** Valorisation du stock actif, à l'achat et à la vente, et compte des alertes. */
    @Query("""
            select new com.boutique.backend.dto.AgregatStock(
                count(p),
                coalesce(sum(p.quantiteStock * p.prixAchat), 0),
                coalesce(sum(p.quantiteStock * p.prixVente), 0),
                coalesce(sum(case when p.quantiteStock <= p.seuilAlerte then 1 else 0 end), 0))
            from Produit p
            where p.actif = true
            """)
    AgregatStock agregerStock();
}
