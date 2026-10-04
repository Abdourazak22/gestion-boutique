package com.boutique.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Un jour ayant enregistré au moins une vente. Les jours creux ne sont pas
 * renvoyés : c'est au client de compléter la fenêtre qu'il affiche, ce qui
 * garde la réponse courte quelle que soit la période demandée.
 */
public record VenteParJour(LocalDate jour, long nombre, BigDecimal montant) {
}
