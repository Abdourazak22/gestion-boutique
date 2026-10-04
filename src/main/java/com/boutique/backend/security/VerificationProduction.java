package com.boutique.backend.security;

import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * Garde-fou de démarrage en production : refuse de servir avec les valeurs de
 * développement. Mieux vaut un échec au boot qu'une application en ligne dont
 * n'importe qui peut forger les jetons.
 *
 * <p>Le contrôle est en {@code @PostConstruct}, c'est-à-dire pendant
 * l'initialisation des beans. Sur un {@code ApplicationReadyEvent} il serait
 * trop tard : Tomcat aurait déjà ouvert le port et l'application aurait annoncé
 * « Started », laissant une fenêtre pendant laquelle elle sert des requêtes avec
 * le secret de développement. Ici l'exception interrompt le refresh du contexte
 * et le port n'est jamais ouvert.
 */
@Configuration
@Profile("prod")
public class VerificationProduction {

    /** Valeur par défaut d'application.properties, publique par nature. */
    static final String SECRET_DE_DEVELOPPEMENT =
            "changer-cette-cle-de-developpement-de-32-octets-minimum";

    private final JwtProperties jwt;
    private final SecuriteProperties securite;

    public VerificationProduction(JwtProperties jwt, SecuriteProperties securite) {
        this.jwt = jwt;
        this.securite = securite;
    }

    @PostConstruct
    void verifier() {
        if (SECRET_DE_DEVELOPPEMENT.equals(jwt.secret())) {
            throw new IllegalStateException(
                    "Le secret JWT de développement est utilisé en production. "
                            + "Définissez la variable d'environnement BOUTIQUE_JWT_SECRET.");
        }
        if (securite.documentationPublique()) {
            throw new IllegalStateException(
                    "boutique.securite.documentation-publique doit valoir false en production.");
        }
        if (securite.originesAutorisees().stream().anyMatch(o -> o.contains("localhost"))) {
            throw new IllegalStateException(
                    "Une origine CORS localhost est déclarée en production : "
                            + securite.originesAutorisees());
        }
    }
}
