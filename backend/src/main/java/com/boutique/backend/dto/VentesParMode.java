package com.boutique.backend.dto;

import com.boutique.backend.model.ModePaiement;
import java.math.BigDecimal;

/**
 * Ce qui a été encaissé par moyen de règlement sur la période.
 *
 * C'est le chiffre du soir : il dit ce qui doit se trouver dans le
 * tiroir-caisse et ce qui a été reçu sur chaque portefeuille mobile.
 */
public record VentesParMode(ModePaiement mode, long nombre, BigDecimal montant) {
}
