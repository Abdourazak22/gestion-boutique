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
import java.time.Instant;
import java.time.LocalDate;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity
@Table(name = "utilisateur")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Utilisateur {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 60)
    private String nom;

    @Column(nullable = false, length = 60)
    private String prenom;

    @Column(nullable = false, unique = true, length = 30)
    private String matricule;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Sexe sexe;

    @Column(name = "date_naissance", nullable = false)
    private LocalDate dateNaissance;

    @Column(nullable = false, unique = true, length = 50)
    private String identifiant;

    /** Hash BCrypt du mot de passe, jamais le mot de passe en clair. */
    @Column(name = "mot_de_passe", nullable = false, length = 100)
    private String motDePasse;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    @Column(nullable = false)
    @Builder.Default
    private boolean actif = true;

    /**
     * Version des jetons. Chaque jeton émis embarque la valeur courante dans le
     * claim {@code jv} ; un jeton dont la version ne correspond plus est refusé.
     *
     * <p>Un compteur plutôt qu'un horodatage : le claim {@code iat} n'a qu'une
     * précision à la seconde, donc une révocation survenant dans la même seconde
     * que l'émission serait indécidable. Un entier n'a pas ce défaut.
     *
     * <p>Colonne nullable pour que l'ajout passe sur une table déjà peuplée ;
     * {@code null} équivaut à la version 0.
     */
    @Column(name = "jeton_version")
    private Long jetonVersion;

    @CreatedDate
    @Column(name = "cree_le", updatable = false)
    private Instant creeLe;

    @LastModifiedDate
    @Column(name = "modifie_le")
    private Instant modifieLe;

    /** Version courante, en traitant l'absence de valeur comme la version 0. */
    public long versionJeton() {
        return jetonVersion == null ? 0L : jetonVersion;
    }

    /**
     * Invalide immédiatement tous les jetons déjà émis pour cet utilisateur.
     * À appeler dès que les droits ou le secret de connexion changent.
     */
    public void revoquerLesJetons() {
        this.jetonVersion = versionJeton() + 1;
    }
}
