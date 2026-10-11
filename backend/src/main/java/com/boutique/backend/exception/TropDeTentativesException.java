package com.boutique.backend.exception;

import java.time.Duration;

/** Trop d'échecs de connexion pour cet identifiant. Traduite en 429. */
public class TropDeTentativesException extends RuntimeException {

    private final Duration attenteRestante;

    public TropDeTentativesException(Duration attenteRestante) {
        super("Trop de tentatives de connexion. Réessayez dans "
                + Math.max(attenteRestante.toMinutes() + 1, 1) + " minute(s).");
        this.attenteRestante = attenteRestante;
    }

    public Duration attenteRestante() {
        return attenteRestante;
    }
}
