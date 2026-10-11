package com.boutique.backend.model;

/**
 * Rôles applicatifs. Le préfixe ROLE_ est ajouté par Spring Security,
 * on ne le stocke donc pas ici.
 */
public enum Role {
    GERANT,
    VENDEUR
}
