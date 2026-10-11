package com.boutique.backend.security;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * @param originesAutorisees    origines autorisées par CORS
 * @param documentationPublique expose Swagger UI et /v3/api-docs sans authentification ;
 *                              doit rester faux en production
 * @param bcryptForce           coût BCrypt (log2 du nombre d'itérations)
 * @param maxTentatives         échecs de connexion tolérés avant blocage temporaire
 * @param dureeBlocage          durée du blocage après dépassement
 */
@ConfigurationProperties(prefix = "boutique.securite")
@Validated
public record SecuriteProperties(
        @NotEmpty(message = "Au moins une origine CORS doit être déclarée")
        List<String> originesAutorisees,

        boolean documentationPublique,

        @Min(value = 10, message = "Un coût BCrypt inférieur à 10 est trop faible")
        int bcryptForce,

        @Min(value = 1, message = "Il faut tolérer au moins une tentative")
        int maxTentatives,

        Duration dureeBlocage) {
}
