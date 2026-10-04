package com.boutique.backend.service;

import com.boutique.backend.dto.ConnexionRequest;
import com.boutique.backend.dto.ConnexionResponse;
import com.boutique.backend.dto.UtilisateurResponse;
import com.boutique.backend.exception.TropDeTentativesException;
import com.boutique.backend.model.Utilisateur;
import com.boutique.backend.security.JwtService;
import com.boutique.backend.security.TentativesConnexionService;
import com.boutique.backend.security.UtilisateurPrincipal;
import java.time.Duration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UtilisateurService utilisateurService;
    private final TentativesConnexionService tentatives;

    public AuthService(AuthenticationManager authenticationManager,
                       JwtService jwtService,
                       UtilisateurService utilisateurService,
                       TentativesConnexionService tentatives) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.utilisateurService = utilisateurService;
        this.tentatives = tentatives;
    }

    /**
     * Vérifie les identifiants et émet un jeton JWT. Les échecs répétés sur un
     * même identifiant déclenchent un blocage temporaire.
     *
     * @throws TropDeTentativesException si l'identifiant est momentanément bloqué
     * @throws AuthenticationException si les identifiants sont invalides ou le
     *         compte désactivé
     */
    public ConnexionResponse connexion(ConnexionRequest requete) {
        Duration blocage = tentatives.tempsDeBlocageRestant(requete.identifiant());
        if (!blocage.isZero()) {
            throw new TropDeTentativesException(blocage);
        }

        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(
                            requete.identifiant(), requete.motDePasse()));
        } catch (AuthenticationException echec) {
            tentatives.enregistrerEchec(requete.identifiant());
            throw echec;
        }

        tentatives.enregistrerSucces(requete.identifiant());
        Utilisateur utilisateur = ((UtilisateurPrincipal) authentication.getPrincipal()).utilisateur();

        return new ConnexionResponse(
                jwtService.genererPour(utilisateur),
                "Bearer",
                jwtService.dureeEnSecondes(),
                UtilisateurResponse.de(utilisateur));
    }

    /** Profil de l'utilisateur porteur du jeton courant. */
    @Transactional(readOnly = true)
    public UtilisateurResponse profil(String identifiant) {
        return UtilisateurResponse.de(utilisateurService.parIdentifiant(identifiant));
    }
}
