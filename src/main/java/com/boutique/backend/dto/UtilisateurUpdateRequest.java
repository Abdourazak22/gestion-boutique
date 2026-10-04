package com.boutique.backend.dto;

import com.boutique.backend.model.Role;
import com.boutique.backend.model.Sexe;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * Modification de l'état civil et du rôle. L'identifiant et le mot de passe ne
 * se changent pas ici : l'identifiant sert de clé de connexion, le mot de passe
 * passe par son propre endpoint.
 */
public record UtilisateurUpdateRequest(
        @NotBlank(message = "Le nom est obligatoire")
        @Size(max = 60, message = "Le nom ne peut dépasser 60 caractères")
        String nom,

        @NotBlank(message = "Le prénom est obligatoire")
        @Size(max = 60, message = "Le prénom ne peut dépasser 60 caractères")
        String prenom,

        @NotBlank(message = "Le matricule est obligatoire")
        @Size(max = 30, message = "Le matricule ne peut dépasser 30 caractères")
        String matricule,

        @NotNull(message = "Le sexe est obligatoire")
        Sexe sexe,

        @NotNull(message = "La date de naissance est obligatoire")
        @Past(message = "La date de naissance doit être dans le passé")
        LocalDate dateNaissance,

        @NotNull(message = "Le rôle est obligatoire")
        Role role) {
}
