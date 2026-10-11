package com.boutique.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity
@Table(name = "produit")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Produit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Verrou optimiste : empêche deux ventes simultanées de décrémenter le même
     * stock à partir de la même valeur lue.
     */
    @Version
    private Long version;

    @Column(nullable = false, unique = true, length = 120)
    private String nom;

    @Column(length = 500)
    private String description;

    /** Prix auquel la boutique achète le produit au grossiste. */
    @Column(name = "prix_achat", nullable = false, precision = 12, scale = 2)
    private BigDecimal prixAchat;

    /** Prix auquel la boutique revend le produit au client. */
    @Column(name = "prix_vente", nullable = false, precision = 12, scale = 2)
    private BigDecimal prixVente;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private UniteMesure unite;

    @Column(name = "quantite_stock", nullable = false)
    @Builder.Default
    private int quantiteStock = 0;

    /** En dessous de ce seuil, le produit est signalé comme à réapprovisionner. */
    @Column(name = "seuil_alerte", nullable = false)
    @Builder.Default
    private int seuilAlerte = 0;

    /**
     * Suppression logique : un produit déjà vendu ne doit pas disparaître
     * de l'historique des achats.
     */
    @Column(nullable = false)
    @Builder.Default
    private boolean actif = true;

    @CreatedDate
    @Column(name = "cree_le", updatable = false)
    private Instant creeLe;

    @LastModifiedDate
    @Column(name = "modifie_le")
    private Instant modifieLe;

    public boolean estEnAlerteStock() {
        return quantiteStock <= seuilAlerte;
    }
}
