package com.boutique.backend.security;

import com.boutique.backend.repository.UtilisateurRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UtilisateurDetailsService implements UserDetailsService {

    private final UtilisateurRepository utilisateurRepository;

    public UtilisateurDetailsService(UtilisateurRepository utilisateurRepository) {
        this.utilisateurRepository = utilisateurRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String identifiant) {
        return utilisateurRepository.findByIdentifiant(identifiant)
                .map(UtilisateurPrincipal::new)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "Aucun utilisateur avec l'identifiant " + identifiant));
    }
}
