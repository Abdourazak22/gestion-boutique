package com.boutique.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Identité de la boutique imprimée en tête du ticket de caisse.
 *
 * @param nom      raison sociale
 * @param adresse  adresse postale, ligne unique
 * @param telephone numéro affiché au client
 * @param devise   libellé court de la monnaie (FCFA, EUR...)
 */
@ConfigurationProperties(prefix = "boutique.identite")
public record BoutiqueProperties(String nom, String adresse, String telephone, String devise) {
}
