package com.boutique.backend.repository;

import com.boutique.backend.dto.AgregatLivraisons;
import com.boutique.backend.model.Livraison;
import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LivraisonRepository extends JpaRepository<Livraison, Long> {

    @EntityGraph(attributePaths = {"lignes", "receptionniste"})
    Optional<Livraison> findWithLignesById(Long id);

    @EntityGraph(attributePaths = {"lignes", "receptionniste"})
    Page<Livraison> findByDateLivraisonBetween(LocalDateTime debut, LocalDateTime fin,
                                               Pageable pageable);

    @EntityGraph(attributePaths = {"lignes", "receptionniste"})
    Page<Livraison> findAllBy(Pageable pageable);

    long countByDateLivraisonBetween(LocalDateTime debut, LocalDateTime fin);

    /** Nombre de réceptions et montant payé aux grossistes sur la période. */
    @Query("""
            select new com.boutique.backend.dto.AgregatLivraisons(
                count(l),
                coalesce(sum(l.montantTotal), 0))
            from Livraison l
            where l.dateLivraison between :debut and :fin
            """)
    AgregatLivraisons agregerLivraisons(@Param("debut") LocalDateTime debut,
                                        @Param("fin") LocalDateTime fin);
}
