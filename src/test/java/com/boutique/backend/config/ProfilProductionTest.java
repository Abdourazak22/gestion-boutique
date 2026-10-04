package com.boutique.backend.config;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;

/**
 * Le profil prod doit refuser de démarrer avec les valeurs de développement.
 * Un démarrage silencieux signifierait une API en ligne dont tout le monde
 * peut forger les jetons.
 */
class ProfilProductionTest {

    /** Recopié pour ne pas élargir la visibilité de la constante de production. */
    private static final String SECRET_DEV =
            "changer-cette-cle-de-developpement-de-32-octets-minimum";
    private static final String SECRET_PROD =
            "un-vrai-secret-de-production-de-32-octets";

    @Test
    void le_profil_prod_refuse_de_demarrer_avec_le_secret_de_developpement() {
        assertThatThrownBy(() -> demarrer(
                "--spring.profiles.active=prod",
                "--spring.jpa.hibernate.ddl-auto=none",
                "--boutique.securite.origines-autorisees=https://boutique.example",
                "--boutique.jwt.secret=" + SECRET_DEV))
                .hasStackTraceContaining("secret JWT de développement est utilisé en production");
    }

    @Test
    void le_profil_prod_refuse_une_origine_cors_localhost() {
        assertThatThrownBy(() -> demarrer(
                "--spring.profiles.active=prod",
                "--spring.jpa.hibernate.ddl-auto=none",
                "--boutique.jwt.secret=" + SECRET_PROD,
                "--boutique.securite.origines-autorisees=http://localhost:3000"))
                .hasStackTraceContaining("origine CORS localhost est déclarée en production");
    }

    @Test
    void le_profil_prod_refuse_la_documentation_publique() {
        assertThatThrownBy(() -> demarrer(
                "--spring.profiles.active=prod",
                "--spring.jpa.hibernate.ddl-auto=none",
                "--boutique.jwt.secret=" + SECRET_PROD,
                "--boutique.securite.origines-autorisees=https://boutique.example",
                "--boutique.securite.documentation-publique=true"))
                .hasStackTraceContaining("documentation-publique doit valoir false");
    }

    @Test
    void un_secret_trop_court_est_refuse_quel_que_soit_le_profil() {
        assertThatThrownBy(() -> demarrer(
                "--spring.jpa.hibernate.ddl-auto=none",
                "--boutique.jwt.secret=trop-court"))
                .hasStackTraceContaining("au moins 32 caractères");
    }

    /**
     * Demarre un contexte servlet complet sur un port libre : SecurityConfig a
     * besoin du bean HttpSecurity, qui n'existe pas dans un contexte non web.
     */
    private void demarrer(String... arguments) {
        SpringApplication application =
                new SpringApplication(com.boutique.backend.BackendApplication.class);
        application.setWebApplicationType(WebApplicationType.SERVLET);
        String[] avecPortLibre = java.util.Arrays.copyOf(arguments, arguments.length + 1);
        avecPortLibre[arguments.length] = "--server.port=0";
        application.run(avecPortLibre).close();
    }
}
