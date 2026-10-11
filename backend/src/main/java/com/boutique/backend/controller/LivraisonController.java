package com.boutique.backend.controller;

import com.boutique.backend.dto.LivraisonRequest;
import com.boutique.backend.dto.LivraisonResponse;
import com.boutique.backend.service.LivraisonService;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.LocalDate;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.web.PagedModel;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/livraisons")
public class LivraisonController {

    private final LivraisonService livraisonService;

    public LivraisonController(LivraisonService livraisonService) {
        this.livraisonService = livraisonService;
    }

    /** Réception d'une livraison grossiste. Réservé au gérant, c'est lui qui achète. */
    @PostMapping
    @PreAuthorize("hasRole('GERANT')")
    public ResponseEntity<LivraisonResponse> enregistrer(
            @Valid @RequestBody LivraisonRequest requete,
            @AuthenticationPrincipal Jwt jwt) {
        LivraisonResponse livraison = livraisonService.enregistrer(requete, jwt.getSubject());
        return ResponseEntity.created(URI.create("/api/livraisons/" + livraison.id()))
                .body(livraison);
    }

    @GetMapping
    public PagedModel<LivraisonResponse> historique(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate du,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate au,
            @PageableDefault(size = 20, sort = "dateLivraison", direction = Sort.Direction.DESC)
            Pageable pagination) {
        return new PagedModel<>(livraisonService.historique(du, au, pagination));
    }

    @GetMapping("/{id}")
    public LivraisonResponse detail(@PathVariable Long id) {
        return livraisonService.parId(id);
    }
}
