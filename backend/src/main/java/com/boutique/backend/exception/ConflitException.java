package com.boutique.backend.exception;

/**
 * Règle métier violée par l'état courant des données (doublon, stock
 * insuffisant...). Traduite en 409 par le GestionnaireExceptions.
 */
public class ConflitException extends RuntimeException {

    public ConflitException(String message) {
        super(message);
    }
}
