package com.boutique.backend.controller;

import com.boutique.backend.dto.ChangementStatutRequest;
import com.boutique.backend.dto.ReinitialisationMotDePasseRequest;
import com.boutique.backend.dto.UtilisateurRequest;
import com.boutique.backend.dto.UtilisateurResponse;
import com.boutique.backend.dto.UtilisateurUpdateRequest;
import com.boutique.backend.service.UtilisateurService;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.web.PagedModel;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Administration du personnel de la boutique. Réservée au gérant. */
@RestController
@RequestMapping("/api/utilisateurs")
@PreAuthorize("hasRole('GERANT')")
public class UtilisateurController {

    private final UtilisateurService utilisateurService;

    public UtilisateurController(UtilisateurService utilisateurService) {
        this.utilisateurService = utilisateurService;
    }

    @PostMapping
    public ResponseEntity<UtilisateurResponse> creer(@Valid @RequestBody UtilisateurRequest requete) {
        UtilisateurResponse cree = utilisateurService.creer(requete);
        return ResponseEntity.created(URI.create("/api/utilisateurs/" + cree.id())).body(cree);
    }

    @GetMapping
    public PagedModel<UtilisateurResponse> lister(
            @PageableDefault(size = 20, sort = "nom", direction = Sort.Direction.ASC)
            Pageable pagination) {
        return new PagedModel<>(utilisateurService.lister(pagination));
    }

    @GetMapping("/{id}")
    public UtilisateurResponse detail(@PathVariable Long id) {
        return utilisateurService.parId(id);
    }

    @PutMapping("/{id}")
    public UtilisateurResponse modifier(@PathVariable Long id,
                                        @Valid @RequestBody UtilisateurUpdateRequest requete) {
        return utilisateurService.modifier(id, requete);
    }

    /**
     * Active ou désactive un compte. Pas de suppression : les achats et livraisons
     * déjà enregistrés référencent leur auteur. La désactivation coupe l'accès
     * immédiatement, jetons en cours compris.
     */
    @PatchMapping("/{id}/statut")
    public UtilisateurResponse changerStatut(@PathVariable Long id,
                                             @Valid @RequestBody ChangementStatutRequest requete) {
        return utilisateurService.changerStatut(id, requete.actif());
    }

    /**
     * Déconnecte un utilisateur de tous ses appareils sans toucher à son compte.
     * Le cas d'usage : un téléphone perdu, alors que la personne doit continuer
     * à travailler dès demain.
     */
    /**
     * Pose un nouveau mot de passe sur le compte d'un employé qui a perdu le
     * sien, et le déconnecte partout.
     *
     * <p>Le gérant ne peut pas se viser lui-même : son propre mot de passe se
     * change dans ses paramètres, où l'actuel est exigé.
     */
    @PatchMapping("/{id}/mot-de-passe")
    public UtilisateurResponse reinitialiserMotDePasse(
            @PathVariable Long id,
            @Valid @RequestBody ReinitialisationMotDePasseRequest requete,
            @AuthenticationPrincipal Jwt jwt) {
        return utilisateurService.reinitialiserMotDePasse(id, jwt.getSubject(), requete);
    }

    @PostMapping("/{id}/deconnexion")
    public UtilisateurResponse deconnecterPartout(@PathVariable Long id) {
        return utilisateurService.revoquerLesJetons(id);
    }
}
