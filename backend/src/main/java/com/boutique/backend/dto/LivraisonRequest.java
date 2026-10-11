package com.boutique.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record LivraisonRequest(
        @NotBlank(message = "Le nom du grossiste est obligatoire")
        @Size(max = 120, message = "Le nom du grossiste ne peut dépasser 120 caractères")
        String nomGrossiste,

        @Size(max = 60, message = "La référence du bon ne peut dépasser 60 caractères")
        String referenceBon,

        @NotEmpty(message = "Une livraison doit comporter au moins un produit")
        @Valid
        List<LigneLivraisonRequest> lignes) {
}
