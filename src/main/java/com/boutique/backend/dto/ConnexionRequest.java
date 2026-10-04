package com.boutique.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record ConnexionRequest(
        @NotBlank(message = "L'identifiant est obligatoire") String identifiant,
        @NotBlank(message = "Le mot de passe est obligatoire") String motDePasse) {
}
