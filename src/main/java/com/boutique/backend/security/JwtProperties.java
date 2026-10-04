package com.boutique.backend.security;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * @param secret   clé HMAC. 32 octets minimum : HS256 exige une clé de 256 bits,
 *                 une clé plus courte est refusée au démarrage.
 * @param duree    durée de validité du jeton
 * @param emetteur valeur du claim "iss", vérifiée aussi à la lecture du jeton
 */
@ConfigurationProperties(prefix = "boutique.jwt")
@Validated
public record JwtProperties(
        @NotBlank(message = "Le secret JWT est obligatoire")
        @Size(min = 32, message = "Le secret JWT doit faire au moins 32 caractères")
        String secret,

        @NotNull(message = "La durée de validité du jeton est obligatoire")
        Duration duree,

        @NotBlank(message = "L'émetteur du jeton est obligatoire")
        String emetteur) {
}
