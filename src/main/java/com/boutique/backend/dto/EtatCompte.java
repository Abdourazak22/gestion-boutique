package com.boutique.backend.dto;

/**
 * Projection minimale servant à valider un jeton : on ne charge pas l'entité
 * entière à chaque requête, seulement de quoi décider si le jeton vaut encore.
 *
 * @param actif        un compte désactivé ne doit plus rien pouvoir faire, même
 *                     avec un jeton encore dans sa fenêtre de validité
 * @param jetonVersion version attendue dans le claim {@code jv}
 */
public record EtatCompte(boolean actif, Long jetonVersion) {

    public long versionJeton() {
        return jetonVersion == null ? 0L : jetonVersion;
    }
}
