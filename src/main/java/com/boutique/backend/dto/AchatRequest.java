package com.boutique.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record AchatRequest(
        @Size(max = 120, message = "Le nom du client ne peut dépasser 120 caractères")
        String nomClient,

        @Size(max = 30, message = "Le téléphone ne peut dépasser 30 caractères")
        String telephoneClient,

        @NotEmpty(message = "Un achat doit comporter au moins un produit")
        @Valid
        List<LigneAchatRequest> lignes) {
}
