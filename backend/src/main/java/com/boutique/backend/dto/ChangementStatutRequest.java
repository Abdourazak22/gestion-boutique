package com.boutique.backend.dto;

import jakarta.validation.constraints.NotNull;

public record ChangementStatutRequest(
        @NotNull(message = "Le statut est obligatoire") Boolean actif) {
}
