package com.boutique.backend.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * La numérotation sous concurrence.
 *
 * <p>Le rang venait d'un {@code count(*) + 1} sur les opérations du jour :
 * deux ventes simultanées lisaient la même valeur, calculaient le même numéro,
 * et la contrainte d'unicité rejetait la seconde. Mesuré sur l'API avant
 * correction, dix ventes lancées ensemble n'en laissaient passer qu'une, et
 * deux ventes séparées de 30 ms suffisaient déjà.
 *
 * <p>Volontairement sans {@code @Transactional} : il faut de vraies
 * transactions concurrentes, et non une transaction de test que les threads se
 * partageraient.
 */
@SpringBootTest
class NumerotationJournaliereTest {

    private static final int SIMULTANES = 20;

    @Autowired
    NumerotationJournaliere numerotation;

    @Test
    void des_appels_simultanes_donnent_tous_un_numero_distinct() throws Exception {
        LocalDate jour = LocalDate.now();
        ExecutorService pool = Executors.newFixedThreadPool(SIMULTANES);
        // Les threads attendent le même signal : sans cela ils partiraient en
        // file indienne et ne prouveraient rien de la concurrence.
        CountDownLatch depart = new CountDownLatch(1);
        List<Future<String>> futurs = new ArrayList<>();

        try {
            for (int i = 0; i < SIMULTANES; i++) {
                futurs.add(pool.submit(() -> {
                    depart.await();
                    return numerotation.prochainNumero("TST", jour);
                }));
            }
            depart.countDown();

            Set<String> numeros = new HashSet<>();
            for (Future<String> futur : futurs) {
                numeros.add(futur.get(30, TimeUnit.SECONDS));
            }
            assertThat(numeros).hasSize(SIMULTANES);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void le_numero_porte_le_prefixe_le_jour_et_un_rang_sur_quatre_chiffres() {
        String numero = numerotation.prochainNumero("ZZZ", LocalDate.of(2026, 10, 8));

        assertThat(numero).matches("ZZZ-20261008-\\d{4}");
    }

    @Test
    void chaque_jour_repart_de_un() {
        // Deux jours volontairement anciens, qu'aucune autre exécution n'a pu
        // toucher : le compteur est partagé par toute la base de test.
        assertThat(numerotation.prochainNumero("JR1", LocalDate.of(2001, 1, 1)))
                .isEqualTo("JR1-20010101-0001");
        assertThat(numerotation.prochainNumero("JR1", LocalDate.of(2001, 1, 2)))
                .isEqualTo("JR1-20010102-0001");
        assertThat(numerotation.prochainNumero("JR1", LocalDate.of(2001, 1, 1)))
                .isEqualTo("JR1-20010101-0002");
    }
}
