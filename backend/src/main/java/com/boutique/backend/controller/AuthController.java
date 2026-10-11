package com.boutique.backend.controller;

import com.boutique.backend.dto.ChangementMotDePasseRequest;
import com.boutique.backend.dto.ConnexionRequest;
import com.boutique.backend.dto.ConnexionResponse;
import com.boutique.backend.dto.UtilisateurResponse;
import com.boutique.backend.service.AuthService;
import com.boutique.backend.service.UtilisateurService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final UtilisateurService utilisateurService;

    public AuthController(AuthService authService, UtilisateurService utilisateurService) {
        this.authService = authService;
        this.utilisateurService = utilisateurService;
    }

    @PostMapping("/connexion")
    public ResponseEntity<ConnexionResponse> connexion(@Valid @RequestBody ConnexionRequest requete) {
        return ResponseEntity.ok(authService.connexion(requete));
    }

    /** Profil de l'utilisateur porteur du jeton. */
    @GetMapping("/moi")
    public ResponseEntity<UtilisateurResponse> moi(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(authService.profil(jwt.getSubject()));
    }

    /**
     * Changement de son propre mot de passe. Révoque tous les jetons déjà émis
     * pour ce compte : il faut se reconnecter, sur tous les appareils.
     */
    @PatchMapping("/mot-de-passe")
    public ResponseEntity<Void> changerMotDePasse(
            @Valid @RequestBody ChangementMotDePasseRequest requete,
            @AuthenticationPrincipal Jwt jwt) {
        utilisateurService.changerMotDePasse(jwt.getSubject(), requete);
        return ResponseEntity.noContent().build();
    }

    /**
     * Déconnexion de tous les appareils. Le jeton courant devient invalide lui
     * aussi : c'est le seul moyen de « se déconnecter » vraiment avec un JWT,
     * que le client ne peut qu'oublier de son côté.
     */
    @PostMapping("/deconnexion")
    public ResponseEntity<Void> deconnexionGlobale(@AuthenticationPrincipal Jwt jwt) {
        utilisateurService.revoquerLesJetons(jwt.getSubject());
        return ResponseEntity.noContent().build();
    }
}
