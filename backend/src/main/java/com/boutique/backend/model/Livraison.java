package com.boutique.backend.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
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
 * Réception de marchandise livrée par un grossiste. En-tête de l'historique des
 * livraisons ; le détail est porté par {@link LigneLivraison}.
 */
@Entity
@Table(name = "livraison")
@Getter
@Setter
@NoArgsConstructor
public class Livraison {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Numéro de bon de réception, du type LIV-20261003-0003. */
    @Column(nullable = false, unique = true, length = 30)
    private String numero;

    @Column(name = "nom_grossiste", nullable = false, length = 120)
    private String nomGrossiste;

    /** Référence du bon de livraison fourni par le grossiste, si renseignée. */
    @Column(name = "reference_bon", length = 60)
    private String referenceBon;

    @Column(name = "date_livraison", nullable = false)
    private LocalDateTime dateLivraison;

    /** Utilisateur qui a réceptionné la livraison. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "receptionniste_id", nullable = false)
    private Utilisateur receptionniste;

    @Column(name = "montant_total", nullable = false, precision = 14, scale = 2)
    private BigDecimal montantTotal = BigDecimal.ZERO;

    @OneToMany(mappedBy = "livraison", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<LigneLivraison> lignes = new ArrayList<>();

    public void ajouterLigne(LigneLivraison ligne) {
        ligne.setLivraison(this);
        lignes.add(ligne);
    }

    public void recalculerTotal() {
        this.montantTotal = lignes.stream()
                .map(LigneLivraison::getMontantLigne)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
