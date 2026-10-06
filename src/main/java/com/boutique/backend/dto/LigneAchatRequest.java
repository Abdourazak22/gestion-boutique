package com.boutique.backend.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record LigneAchatRequest(
        @NotNull(message = "L'identifiant du produit est obligatoire") Long produitId,
        @NotNull(message = "La quantité est obligatoire")
        @Min(value = 1, message = "La quantité doit être au moins de 1") Integer quantite)
        implements LigneProduit {
}
