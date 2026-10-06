package com.boutique.backend.dto;

import com.boutique.backend.exception.ConflitException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Bornes temporelles d'une période exprimée en jours.
 *
 * <p>Ce calcul était recopié en quatre endroits : les deux historiques, les
 * agrégats du tableau de bord et la numérotation quotidienne. Avec le message
 * d'erreur à chaque fois, et surtout avec la même borne haute fausse.
 */
public record PlageDeDates(LocalDateTime debut, LocalDateTime fin) {

    /** Antérieure à toute donnée saisissable : sert de borne basse ouverte. */
    private static final LocalDateTime DEBUT_DES_TEMPS =
            LocalDate.of(1970, 1, 1).atStartOfDay();

    /**
     * Période entre deux dates incluses, chacune pouvant être absente.
     *
     * @throws ConflitException si le début est postérieur à la fin
     */
    public static PlageDeDates de(LocalDate du, LocalDate au) {
        LocalDateTime debut = du != null ? du.atStartOfDay() : DEBUT_DES_TEMPS;
        // Borne haute ouverte volontairement très lointaine plutôt que
        // « maintenant » : une opération horodatée à la seconde près ne doit pas
        // sortir du filtre parce que la requête a été évaluée un instant plus tôt.
        LocalDateTime fin = au != null ? finDeJournee(au) : LocalDateTime.now().plusYears(100);

        if (debut.isAfter(fin)) {
            throw new ConflitException("La date de début est postérieure à la date de fin");
        }
        return new PlageDeDates(debut, fin);
    }

    /** Une journée entière, du premier au dernier instant. */
    public static PlageDeDates journee(LocalDate jour) {
        return new PlageDeDates(jour.atStartOfDay(), finDeJournee(jour));
    }

    /**
     * Dernier instant d'une journée.
     *
     * <p>{@link LocalTime#MAX} et non {@code 23:59:59} : les colonnes sont en
     * {@code timestamp(6)}, et une borne à la seconde pleine laissait dehors
     * tout ce qui tombait entre 23:59:59,000001 et 23:59:59,999999. Une vente
     * enregistrée dans cette fenêtre disparaissait de l'historique du jour et,
     * plus grave, du chiffre d'affaires et de la marge du tableau de bord.
     */
    private static LocalDateTime finDeJournee(LocalDate jour) {
        return jour.atTime(LocalTime.MAX);
    }
}
