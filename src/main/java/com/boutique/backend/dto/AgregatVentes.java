package com.boutique.backend.dto;

import java.math.BigDecimal;

/**
 * Totaux des ventes sur une période, calculés en base.
 *
 * Le panier moyen et le taux de marge ne figurent pas ici : ce sont deux
 * divisions que le client fait aussi bien, et les laisser dehors évite de
 * figer côté serveur une politique d'arrondi.
 *
 * @param nombre          nombre de ventes
 * @param chiffreAffaires somme des montants vendus
 * @param marge           chiffre d'affaires moins le coût de revient des lignes
 */
public record AgregatVentes(long nombre, BigDecimal chiffreAffaires, BigDecimal marge) {
}
