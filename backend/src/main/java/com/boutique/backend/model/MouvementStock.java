package com.boutique.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * Une variation du stock d'un produit, avec sa cause et son auteur.
 *
 * <p>Écrit uniquement par {@code ProduitService}, qui modifie le stock et
 * enregistre le mouvement dans la même opération : les deux ne peuvent pas
 * diverger par construction.
 *
 * <p>{@code variation} est signée. La somme des variations d'un produit est
 * donc égale à son {@code quantiteStock}, invariant qui permet de détecter
 * qu'un chemin a contourné le journal.
 */
@Entity
@Table(name = "mouvement_stock")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MouvementStock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "produit_id", nullable = false)
    private Produit produit;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TypeMouvement type;

    /**
     * Négative pour une sortie, positive pour une entrée.
     *
     * <p>Nulle dans un seul cas : un comptage d'inventaire qui confirme le
     * stock enregistré. Le comptage a bien eu lieu et mérite sa trace, même
     * s'il n'a rien corrigé.
     */
    @Column(nullable = false)
    private int variation;

    /**
     * Stock avant et après le mouvement, conservés tels quels.
     *
     * <p>Redondants avec la somme des variations, et c'est voulu : ils rendent
     * chaque ligne lisible seule, sans rejouer tout l'historique du produit.
     */
    @Column(name = "stock_avant", nullable = false)
    private int stockAvant;

    @Column(name = "stock_apres", nullable = false)
    private int stockApres;

    /** Renseigné pour un ajustement d'inventaire, nul pour les autres types. */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private MotifAjustement motif;

    @Column(length = 300)
    private String commentaire;

    /**
     * Numéro de la vente ou de la livraison à l'origine du mouvement, pour
     * remonter du journal à l'opération sans jointure.
     */
    @Column(length = 30)
    private String reference;

    /**
     * Qui a provoqué le mouvement. Nul uniquement pour la reprise de stock
     * insérée par la migration, antérieure au journal : une contrainte en base
     * interdit un mouvement anonyme dans tous les autres cas.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "auteur_id")
    private Utilisateur auteur;

    @CreatedDate
    @Column(name = "cree_le", updatable = false)
    private Instant creeLe;
}
