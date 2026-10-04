package com.boutique.backend.controller;

import com.boutique.backend.dto.StatistiquesResponse;
import com.boutique.backend.service.StatistiquesService;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Chiffres de pilotage de la boutique.
 *
 * Réservé au gérant : ce sont les performances commerciales de l'entreprise,
 * marge comprise. Un vendeur travaille à la caisse et consulte le stock, il n'a
 * pas à lire la rentabilité.
 */
@RestController
@RequestMapping("/api/statistiques")
@PreAuthorize("hasRole('GERANT')")
public class StatistiquesController {

    private final StatistiquesService statistiquesService;

    public StatistiquesController(StatistiquesService statistiquesService) {
        this.statistiquesService = statistiquesService;
    }

    /** Bornes incluses et optionnelles ; par défaut, le mois en cours. */
    @GetMapping
    public StatistiquesResponse tableauDeBord(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate du,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate au) {
        return statistiquesService.duTableauDeBord(du, au);
    }
}
