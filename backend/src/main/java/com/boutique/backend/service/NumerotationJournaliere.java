package com.boutique.backend.service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Attribue les numéros d'opération de la forme {@code ACH-20261008-0001}.
 *
 * <p>Remplace le {@code count(*) + 1} que portaient {@code AchatService} et
 * {@code LivraisonService}. Ce comptage se faisait avant l'insertion : deux
 * ventes simultanées lisaient la même valeur et produisaient le même numéro,
 * que la contrainte d'unicité rejetait. Dix ventes lancées ensemble n'en
 * laissaient passer qu'une.
 *
 * <p>L'incrément se fait désormais en une seule instruction atomique. Deux
 * transactions concurrentes se sérialisent sur la ligne du jour et obtiennent
 * deux rangs distincts : aucune ne échoue, et aucune ne relit un compteur
 * qu'une autre s'apprête à changer.
 */
@Component
public class NumerotationJournaliere {

    private static final DateTimeFormatter JOUR = DateTimeFormatter.ofPattern("yyyyMMdd");

    /**
     * Le {@code returning} rend la valeur attribuée dans la même instruction.
     * Rien n'est relu ensuite : c'est ce qui ferme la fenêtre de concurrence.
     */
    private static final String PROCHAIN_RANG = """
            insert into compteur_journalier (prefixe, jour, dernier)
            values (?, ?, 1)
            on conflict (prefixe, jour)
              do update set dernier = compteur_journalier.dernier + 1
            returning dernier
            """;

    private final JdbcTemplate jdbc;

    public NumerotationJournaliere(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Numéro suivant pour ce préfixe et ce jour.
     *
     * <p>À appeler dans la transaction de l'opération numérotée : si celle-ci
     * est annulée, le rang l'est avec elle et n'est pas consommé pour rien.
     *
     * @param prefixe {@code ACH} pour une vente, {@code LIV} pour une livraison
     */
    public String prochainNumero(String prefixe, LocalDate jour) {
        Integer rang = jdbc.queryForObject(PROCHAIN_RANG, Integer.class, prefixe, jour);
        return "%s-%s-%04d".formatted(prefixe, jour.format(JOUR), rang);
    }
}
