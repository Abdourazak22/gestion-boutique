package com.boutique.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Un produit reçu dans une livraison, au prix d'achat négocié ce jour-là. */
@Entity
@Table(name = "ligne_livraison")
@Getter
@Setter
@NoArgsConstructor
public class LigneLivraison {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "livraison_id", nullable = false)
    private Livraison livraison;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "produit_id", nullable = false)
    private Produit produit;

    @Column(name = "nom_produit", nullable = false, length = 120)
    private String nomProduit;

    @Column(nullable = false)
    private int quantite;

    /**
     * Prix d'achat unitaire de cette livraison. Peut différer du prix d'achat
     * courant du produit : c'est le prix réellement payé au grossiste.
     */
    @Column(name = "prix_unitaire", nullable = false, precision = 12, scale = 2)
    private BigDecimal prixUnitaire;

    @Column(name = "montant_ligne", nullable = false, precision = 14, scale = 2)
    private BigDecimal montantLigne;

    public static LigneLivraison de(Produit produit, int quantite, BigDecimal prixUnitaire) {
        LigneLivraison ligne = new LigneLivraison();
        ligne.produit = produit;
        ligne.nomProduit = produit.getNom();
        ligne.quantite = quantite;
        ligne.prixUnitaire = prixUnitaire;
        ligne.montantLigne = prixUnitaire.multiply(BigDecimal.valueOf(quantite));
        return ligne;
    }
}
