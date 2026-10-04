package com.boutique.backend.exception;

/** Traduite en 404 par le GestionnaireExceptions. */
public class RessourceIntrouvableException extends RuntimeException {

    public RessourceIntrouvableException(String message) {
        super(message);
    }

    public static RessourceIntrouvableException de(String ressource, Object identifiant) {
        return new RessourceIntrouvableException(ressource + " introuvable : " + identifiant);
    }
}
