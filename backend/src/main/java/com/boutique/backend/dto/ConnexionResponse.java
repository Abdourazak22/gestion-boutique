package com.boutique.backend.dto;

public record ConnexionResponse(
        String jeton,
        String typeJeton,
        long expireDansSecondes,
        UtilisateurResponse utilisateur) {
}
