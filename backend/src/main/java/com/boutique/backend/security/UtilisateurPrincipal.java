package com.boutique.backend.security;

import com.boutique.backend.model.Utilisateur;
import java.util.Collection;
import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

/**
 * Adaptateur entre l'entité {@link Utilisateur} et le contrat Spring Security.
 * L'entité du modèle reste ainsi libre de toute dépendance au framework.
 */
public record UtilisateurPrincipal(Utilisateur utilisateur) implements UserDetails {

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + utilisateur.getRole().name()));
    }

    @Override
    public String getPassword() {
        return utilisateur.getMotDePasse();
    }

    @Override
    public String getUsername() {
        return utilisateur.getIdentifiant();
    }

    @Override
    public boolean isEnabled() {
        return utilisateur.isActif();
    }
}
