package com.boutique.backend.dto;

import com.boutique.backend.model.Role;
import com.boutique.backend.model.Sexe;
import com.boutique.backend.model.Utilisateur;
import java.time.LocalDate;

public record UtilisateurResponse(
        Long id,
        String nom,
        String prenom,
        String matricule,
        Sexe sexe,
        LocalDate dateNaissance,
        String identifiant,
        Role role,
        boolean actif) {

    public static UtilisateurResponse de(Utilisateur utilisateur) {
        return new UtilisateurResponse(
                utilisateur.getId(),
                utilisateur.getNom(),
                utilisateur.getPrenom(),
                utilisateur.getMatricule(),
                utilisateur.getSexe(),
                utilisateur.getDateNaissance(),
                utilisateur.getIdentifiant(),
                utilisateur.getRole(),
                utilisateur.isActif());
    }
}
