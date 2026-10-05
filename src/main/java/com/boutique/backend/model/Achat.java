package com.boutique.backend.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Vente à un client. En-tête de l'historique des achats ; le détail des produits
 * vendus est porté par {@link LigneAchat}.
 */
@Entity
@Table(name = "achat")
@Getter
@Setter
@NoArgsConstructor
public class Achat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Numéro de ticket lisible, du type ACH-20261003-0007. */
    @Column(nullable = false, unique = true, length = 30)
    private String numero;

    @Column(name = "nom_client", length = 120)
    private String nomClient;

    @Column(name = "telephone_client", length = 30)
    private String telephoneClient;

    @Column(name = "date_achat", nullable = false)
    private LocalDateTime dateAchat;

    /** Utilisateur qui a encaissé la vente. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vendeur_id", nullable = false)
    private Utilisateur vendeur;

    @Column(name = "montant_total", nullable = false, precision = 14, scale = 2)
    private BigDecimal montantTotal = BigDecimal.ZERO;

    /**
     * Moyen de règlement, obligatoire : sans lui, impossible de savoir en fin
     * de journée ce qui doit se trouver dans le tiroir-caisse et ce qui a été
     * reçu sur un portefeuille mobile.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "mode_paiement", nullable = false, length = 20)
    private ModePaiement modePaiement;

    @OneToMany(mappedBy = "achat", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<LigneAchat> lignes = new ArrayList<>();

    public void ajouterLigne(LigneAchat ligne) {
        ligne.setAchat(this);
        lignes.add(ligne);
    }

    /** Recalcule le total à partir des lignes, seule source de vérité. */
    public void recalculerTotal() {
        this.montantTotal = lignes.stream()
                .map(LigneAchat::getMontantLigne)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
