package com.boutique.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangementMotDePasseRequest(
        @NotBlank(message = "Le mot de passe actuel est obligatoire")
        String motDePasseActuel,

        @NotBlank(message = "Le nouveau mot de passe est obligatoire")
        @Size(min = 8, max = 72, message = "Le nouveau mot de passe doit faire au moins 8 caractères")
        String nouveauMotDePasse) {
}
