package com.boutique.backend.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Freine le bourrage de mots de passe sur l'endpoint de connexion.
 *
 * <p>Les compteurs vivent dans deux caches <b>bornés et à expiration</b>. Ce
 * n'est pas un détail de confort : l'endpoint de connexion est public, donc un
 * attaquant qui envoie un échec par identifiant aléatoire ferait grossir une
 * simple Map sans fin. Le garde-fou anti-bourrage deviendrait alors lui-même un
 * déni de service par épuisement mémoire.
 *
 * <p>État en mémoire : remis à zéro au redémarrage et non partagé entre
 * instances. Suffisant pour un déploiement mono-instance ; au-delà, il faut
 * déporter les compteurs dans Redis.
 *
 * <p>Le blocage porte sur l'identifiant, pas sur l'adresse IP. C'est le choix
 * qui protège réellement un compte donné, au prix d'un déni de service ciblé
 * possible : un attaquant connaissant un identifiant peut le bloquer pendant
 * la durée configurée. Le blocage reste donc volontairement court.
 */
@Service
public class TentativesConnexionService {

    private static final Logger log = LoggerFactory.getLogger(TentativesConnexionService.class);

    /**
     * Plafond d'identifiants suivis simultanément. Au-delà, Caffeine évince les
     * entrées les moins utiles : on perd des compteurs d'échecs, jamais la
     * mémoire du serveur.
     */
    private static final long CAPACITE = 10_000;

    private final Cache<String, AtomicInteger> echecs;
    private final Cache<String, Instant> blocages;
    private final int maxTentatives;
    private final Duration dureeBlocage;

    public TentativesConnexionService(SecuriteProperties proprietes) {
        this.maxTentatives = proprietes.maxTentatives();
        this.dureeBlocage = proprietes.dureeBlocage();
        // Un compteur d'echecs qui n'a pas bouge depuis la duree de blocage
        // n'interesse plus personne : on repart de zero.
        this.echecs = Caffeine.newBuilder()
                .maximumSize(CAPACITE)
                .expireAfterWrite(dureeBlocage)
                .build();
        this.blocages = Caffeine.newBuilder()
                .maximumSize(CAPACITE)
                .expireAfterWrite(dureeBlocage)
                .build();
    }

    /** @return le temps restant avant déblocage, ou {@link Duration#ZERO} si libre */
    public Duration tempsDeBlocageRestant(String identifiant) {
        Instant jusqua = blocages.getIfPresent(cle(identifiant));
        if (jusqua == null) {
            return Duration.ZERO;
        }
        Duration restant = Duration.between(Instant.now(), jusqua);
        if (restant.isNegative() || restant.isZero()) {
            liberer(identifiant);
            return Duration.ZERO;
        }
        return restant;
    }

    public void enregistrerEchec(String identifiant) {
        int total = echecs.get(cle(identifiant), k -> new AtomicInteger()).incrementAndGet();
        log.warn("Echec de connexion pour '{}' ({}/{})", identifiant, total, maxTentatives);

        if (total >= maxTentatives) {
            blocages.put(cle(identifiant), Instant.now().plus(dureeBlocage));
            echecs.invalidate(cle(identifiant));
            log.warn("Connexion bloquee pour '{}' pendant {}", identifiant, dureeBlocage);
        }
    }

    public void enregistrerSucces(String identifiant) {
        liberer(identifiant);
        log.info("Connexion reussie pour '{}'", identifiant);
    }

    /** Nombre d'identifiants actuellement suivis. Sert à prouver le bornage. */
    public long identifiantsSuivis() {
        echecs.cleanUp();
        blocages.cleanUp();
        return echecs.estimatedSize() + blocages.estimatedSize();
    }

    private void liberer(String identifiant) {
        echecs.invalidate(cle(identifiant));
        blocages.invalidate(cle(identifiant));
    }

    /** Normalise pour qu'une variation de casse ne contourne pas le compteur. */
    private String cle(String identifiant) {
        return identifiant == null ? "" : identifiant.toLowerCase();
    }
}
