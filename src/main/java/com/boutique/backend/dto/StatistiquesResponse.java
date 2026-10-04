package com.boutique.backend.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Agrégats du tableau de bord pour une période donnée.
 *
 * Tout est calculé par la base : les chiffres portent sur l'intégralité des
 * enregistrements de la période, jamais sur un échantillon.
 *
 * @param du    première journée incluse
 * @param au    dernière journée incluse
 * @param stock état courant du stock, indépendant de la période
 */
public record StatistiquesResponse(
        LocalDate du,
        LocalDate au,
        AgregatVentes ventes,
        AgregatLivraisons livraisons,
        AgregatStock stock,
        List<VenteParJour> ventesParJour,
        List<ProduitVendu> meilleuresVentes) {
}
