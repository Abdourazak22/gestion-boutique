package com.boutique.backend.dto;

import java.math.BigDecimal;

/**
 * Totaux des réceptions grossistes sur une période.
 *
 * @param nombre       nombre de livraisons
 * @param montantTotal somme payée aux grossistes
 */
public record AgregatLivraisons(long nombre, BigDecimal montantTotal) {
}
