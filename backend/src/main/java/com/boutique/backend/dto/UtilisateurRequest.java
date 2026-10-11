package com.boutique.backend.dto;

import com.boutique.backend.model.Role;
import com.boutique.backend.model.Sexe;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record UtilisateurRequest(
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

        @NotBlank(message = "L'identifiant est obligatoire")
        @Size(min = 3, max = 50, message = "L'identifiant doit faire entre 3 et 50 caractères")
        @Pattern(regexp = "^[a-zA-Z0-9._-]+$",
                message = "L'identifiant n'accepte que lettres, chiffres, point, tiret et souligné")
        String identifiant,

        @NotBlank(message = "Le mot de passe est obligatoire")
        @Size(min = 8, max = 72, message = "Le mot de passe doit faire au moins 8 caractères")
        String motDePasse,

        @NotNull(message = "Le rôle est obligatoire")
        Role role) {
}
