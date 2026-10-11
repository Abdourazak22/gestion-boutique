package com.boutique.backend.exception;

import java.time.Instant;
import java.util.Map;

/** Corps de réponse unique pour toutes les erreurs de l'API. */
public record ApiError(
        Instant horodatage,
        int statut,
        String message,
        Map<String, String> champs) {

    public static ApiError de(int statut, String message) {
        return new ApiError(Instant.now(), statut, message, Map.of());
    }

    public static ApiError de(int statut, String message, Map<String, String> champs) {
        return new ApiError(Instant.now(), statut, message, champs);
    }
}
