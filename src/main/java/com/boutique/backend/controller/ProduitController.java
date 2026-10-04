package com.boutique.backend.controller;

import com.boutique.backend.dto.ProduitRequest;
import com.boutique.backend.dto.ProduitResponse;
import com.boutique.backend.service.ProduitService;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.web.PagedModel;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/produits")
public class ProduitController {

    private final ProduitService produitService;

    public ProduitController(ProduitService produitService) {
        this.produitService = produitService;
    }

    /** Catalogue paginé. Le paramètre {@code nom} active la recherche par nom. */
    @GetMapping
    public PagedModel<ProduitResponse> lister(
            @RequestParam(required = false) String nom,
            @PageableDefault(size = 20, sort = "nom", direction = Sort.Direction.ASC)
            Pageable pagination) {
        return new PagedModel<>(produitService.rechercher(nom, pagination));
    }

    @GetMapping("/alertes-stock")
    public PagedModel<ProduitResponse> alertesStock(
            @PageableDefault(size = 20, sort = "nom") Pageable pagination) {
        return new PagedModel<>(produitService.enAlerteStock(pagination));
    }

    @GetMapping("/{id}")
    public ProduitResponse detail(@PathVariable Long id) {
        return produitService.parId(id);
    }

    @PostMapping
    @PreAuthorize("hasRole('GERANT')")
    public ResponseEntity<ProduitResponse> creer(@Valid @RequestBody ProduitRequest requete) {
        ProduitResponse cree = produitService.creer(requete);
        return ResponseEntity.created(URI.create("/api/produits/" + cree.id())).body(cree);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('GERANT')")
    public ProduitResponse modifier(@PathVariable Long id,
                                    @Valid @RequestBody ProduitRequest requete) {
        return produitService.modifier(id, requete);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('GERANT')")
    public ResponseEntity<Void> supprimer(@PathVariable Long id) {
        produitService.supprimer(id);
        return ResponseEntity.noContent().build();
    }
}
