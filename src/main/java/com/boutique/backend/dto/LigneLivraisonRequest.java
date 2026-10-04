package com.boutique.backend.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record LigneLivraisonRequest(
        @NotNull(message = "L'identifiant du produit est obligatoire") Long produitId,

        @NotNull(message = "La quantité est obligatoire")
        @Min(value = 1, message = "La quantité doit être au moins de 1") Integer quantite,

        /** Prix payé au grossiste. Si absent, le prix d'achat courant du produit est utilisé. */
        @DecimalMin(value = "0.0", message = "Le prix unitaire ne peut être négatif")
        @Digits(integer = 10, fraction = 2, message = "Le prix unitaire doit avoir au plus 2 décimales")
        BigDecimal prixUnitaire) {
}
