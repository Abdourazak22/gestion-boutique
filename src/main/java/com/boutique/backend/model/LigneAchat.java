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

/** Un produit vendu dans un achat, avec le prix figé au moment de la vente. */
@Entity
@Table(name = "ligne_achat")
@Getter
@Setter
@NoArgsConstructor
public class LigneAchat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "achat_id", nullable = false)
    private Achat achat;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "produit_id", nullable = false)
    private Produit produit;

    /**
     * Nom du produit recopié à la vente : l'historique doit rester lisible même
     * si le produit est renommé ou retiré du catalogue ensuite.
     */
    @Column(name = "nom_produit", nullable = false, length = 120)
    private String nomProduit;

    @Column(nullable = false)
    private int quantite;

    /** Prix de vente unitaire au moment de la vente, pas le prix courant. */
    @Column(name = "prix_unitaire", nullable = false, precision = 12, scale = 2)
    private BigDecimal prixUnitaire;

    /**
     * Prix d'achat unitaire au moment de la vente : c'est le coût de revient de
     * cette ligne, figé comme le prix de vente.
     *
     * Sans lui, la marge réalisée se calculerait contre le prix d'achat courant
     * du produit et changerait rétroactivement à chaque renégociation avec le
     * grossiste. Nullable pour les lignes enregistrées avant son introduction :
     * les agrégats retombent alors sur le prix d'achat courant.
     */
    @Column(name = "prix_achat_unitaire", precision = 12, scale = 2)
    private BigDecimal prixAchatUnitaire;

    @Column(name = "montant_ligne", nullable = false, precision = 14, scale = 2)
    private BigDecimal montantLigne;

    public static LigneAchat de(Produit produit, int quantite) {
        LigneAchat ligne = new LigneAchat();
        ligne.produit = produit;
        ligne.nomProduit = produit.getNom();
        ligne.quantite = quantite;
        ligne.prixUnitaire = produit.getPrixVente();
        ligne.prixAchatUnitaire = produit.getPrixAchat();
        ligne.montantLigne = produit.getPrixVente().multiply(BigDecimal.valueOf(quantite));
        return ligne;
    }
}
