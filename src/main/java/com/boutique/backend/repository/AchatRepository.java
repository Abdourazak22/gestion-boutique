package com.boutique.backend.repository;

import com.boutique.backend.dto.AgregatVentes;
import com.boutique.backend.dto.ProduitVendu;
import com.boutique.backend.dto.VenteParJour;
import com.boutique.backend.dto.VentesParMode;
import com.boutique.backend.model.Achat;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AchatRepository extends JpaRepository<Achat, Long> {

    /** Charge les lignes dans la même requête : évite le N+1 à l'affichage du ticket. */
    @EntityGraph(attributePaths = {"lignes", "vendeur"})
    Optional<Achat> findWithLignesById(Long id);

    @EntityGraph(attributePaths = {"lignes", "vendeur"})
    Page<Achat> findByDateAchatBetween(LocalDateTime debut, LocalDateTime fin, Pageable pageable);

    @EntityGraph(attributePaths = {"lignes", "vendeur"})
    Page<Achat> findAllBy(Pageable pageable);

    long countByDateAchatBetween(LocalDateTime debut, LocalDateTime fin);

    /**
     * Totaux des ventes de la période, agrégés par la base.
     *
     * Le coût de revient vient du prix d'achat figé dans la ligne ; pour les
     * lignes antérieures à ce champ, on retombe sur le prix d'achat courant du
     * produit, approximation assumée plutôt qu'une marge nulle.
     */
    @Query("""
            select new com.boutique.backend.dto.AgregatVentes(
                count(distinct a.id),
                coalesce(sum(l.montantLigne), 0),
                coalesce(sum(
                    (l.prixUnitaire - coalesce(l.prixAchatUnitaire, p.prixAchat))
                    * l.quantite), 0))
            from Achat a
                join a.lignes l
                join l.produit p
            where a.dateAchat between :debut and :fin
                and a.statut = com.boutique.backend.model.StatutAchat.PAYE
            """)
    AgregatVentes agregerVentes(@Param("debut") LocalDateTime debut,
                                @Param("fin") LocalDateTime fin);

    /** Un enregistrement par journée ayant vendu, du plus ancien au plus récent. */
    @Query("""
            select new com.boutique.backend.dto.VenteParJour(
                cast(a.dateAchat as LocalDate),
                count(a),
                coalesce(sum(a.montantTotal), 0))
            from Achat a
            where a.dateAchat between :debut and :fin
                and a.statut = com.boutique.backend.model.StatutAchat.PAYE
            group by cast(a.dateAchat as LocalDate)
            order by cast(a.dateAchat as LocalDate)
            """)
    List<VenteParJour> ventesParJour(@Param("debut") LocalDateTime debut,
                                     @Param("fin") LocalDateTime fin);

    /**
     * Répartition des encaissements par moyen de règlement, du plus gros au
     * plus petit. Les ventes antérieures à l'introduction du champ n'ont pas de
     * mode et sont écartées plutôt que rangées dans une catégorie fausse.
     */
    @Query("""
            select new com.boutique.backend.dto.VentesParMode(
                a.modePaiement,
                count(a),
                coalesce(sum(a.montantTotal), 0))
            from Achat a
            where a.dateAchat between :debut and :fin
                and a.statut = com.boutique.backend.model.StatutAchat.PAYE
                and a.modePaiement is not null
            group by a.modePaiement
            order by sum(a.montantTotal) desc
            """)
    List<VentesParMode> ventesParModePaiement(@Param("debut") LocalDateTime debut,
                                              @Param("fin") LocalDateTime fin);

    /**
     * Produits les plus vendus de la période, par chiffre d'affaires décroissant.
     * Le regroupement porte sur l'identifiant : un produit renommé entre-temps
     * reste une seule ligne de classement.
     */
    @Query("""
            select new com.boutique.backend.dto.ProduitVendu(
                p.id,
                p.nom,
                sum(l.quantite),
                sum(l.montantLigne),
                sum((l.prixUnitaire - coalesce(l.prixAchatUnitaire, p.prixAchat))
                    * l.quantite))
            from LigneAchat l
                join l.achat a
                join l.produit p
            where a.dateAchat between :debut and :fin
                and a.statut = com.boutique.backend.model.StatutAchat.PAYE
            group by p.id, p.nom
            order by sum(l.montantLigne) desc
            """)
    List<ProduitVendu> meilleuresVentes(@Param("debut") LocalDateTime debut,
                                        @Param("fin") LocalDateTime fin,
                                        Pageable limite);
}
