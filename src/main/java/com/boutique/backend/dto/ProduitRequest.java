package com.boutique.backend.dto;

import com.boutique.backend.model.UniteMesure;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record ProduitRequest(
        @NotBlank(message = "Le nom est obligatoire")
        @Size(max = 120, message = "Le nom ne peut dépasser 120 caractères")
        String nom,

        @Size(max = 500, message = "La description ne peut dépasser 500 caractères")
        String description,

        @NotNull(message = "Le prix d'achat est obligatoire")
        @DecimalMin(value = "0.0", message = "Le prix d'achat ne peut être négatif")
        @Digits(integer = 10, fraction = 2, message = "Le prix d'achat doit avoir au plus 2 décimales")
        BigDecimal prixAchat,

        @NotNull(message = "Le prix de vente est obligatoire")
        @DecimalMin(value = "0.0", message = "Le prix de vente ne peut être négatif")
        @Digits(integer = 10, fraction = 2, message = "Le prix de vente doit avoir au plus 2 décimales")
        BigDecimal prixVente,

        @NotNull(message = "L'unité de mesure est obligatoire")
        UniteMesure unite,

        @NotNull(message = "La quantité en stock est obligatoire")
        @Min(value = 0, message = "La quantité en stock ne peut être négative")
        Integer quantiteStock,

        @NotNull(message = "Le seuil d'alerte est obligatoire")
        @Min(value = 0, message = "Le seuil d'alerte ne peut être négatif")
        Integer seuilAlerte) {
}
