package com.boutique.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Nouveau mot de passe posé par le gérant sur le compte d'un employé qui a
 * perdu le sien.
 *
 * <p>Ne demande pas l'ancien, contrairement à {@link ChangementMotDePasseRequest} :
 * c'est tout l'objet de l'opération, personne ne le connaît plus. La garantie
 * vient d'ailleurs — seul le gérant peut appeler cet endpoint, et il ne peut
 * pas le viser sur son propre compte.
 */
public record ReinitialisationMotDePasseRequest(
        @NotBlank(message = "Le nouveau mot de passe est obligatoire")
        @Size(min = 8, max = 72, message = "Le nouveau mot de passe doit faire au moins 8 caractères")
        String nouveauMotDePasse) {
}
