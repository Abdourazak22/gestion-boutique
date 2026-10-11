package com.boutique.backend.controller;

import com.boutique.backend.dto.AjustementStockRequest;
import com.boutique.backend.dto.MouvementStockResponse;
import com.boutique.backend.dto.ProduitRequest;
import com.boutique.backend.dto.ProduitResponse;
import com.boutique.backend.dto.ProduitUpdateRequest;
import com.boutique.backend.service.ProduitService;
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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
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

    /**
     * Crée un produit. Le stock initial saisi ici devient le premier mouvement
     * du journal, attribué à son auteur.
     */
    @PostMapping
    @PreAuthorize("hasRole('GERANT')")
    public ResponseEntity<ProduitResponse> creer(@Valid @RequestBody ProduitRequest requete,
                                                 @AuthenticationPrincipal Jwt jwt) {
        ProduitResponse cree = produitService.creer(requete, jwt.getSubject());
        return ResponseEntity.created(URI.create("/api/produits/" + cree.id())).body(cree);
    }

    /**
     * Modifie la fiche d'un produit : nom, description, prix, unité, seuil
     * d'alerte. Pas le stock, qui ne se corrige que par un ajustement
     * d'inventaire.
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('GERANT')")
    public ProduitResponse modifier(@PathVariable Long id,
                                    @Valid @RequestBody ProduitUpdateRequest requete) {
        return produitService.modifier(id, requete);
    }

    /**
     * Aligne le stock enregistré sur le stock compté en rayon.
     *
     * <p>Réservé au gérant, pour la même raison que l'annulation d'une vente :
     * c'est le mécanisme qui permettrait de faire disparaître un manquant.
     * Celui qui tient la caisse ne doit pas pouvoir effacer l'écart qu'elle
     * laisse.
     */
    @PatchMapping("/{id}/ajustement")
    @PreAuthorize("hasRole('GERANT')")
    public ProduitResponse ajuster(@PathVariable Long id,
                                   @Valid @RequestBody AjustementStockRequest requete,
                                   @AuthenticationPrincipal Jwt jwt) {
        return produitService.ajuster(id, requete, jwt.getSubject());
    }

    /**
     * Historique des mouvements de stock d'un produit.
     *
     * <p>Réservé au gérant : c'est le registre où se lisent les pertes et les
     * corrections, donc aussi ce qui permettrait de repérer qui a saisi quoi.
     */
    @GetMapping("/{id}/mouvements")
    @PreAuthorize("hasRole('GERANT')")
    public PagedModel<MouvementStockResponse> mouvements(
            @PathVariable Long id,
            @PageableDefault(size = 20) Pageable pagination) {
        return new PagedModel<>(produitService.mouvements(id, pagination));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('GERANT')")
    public ResponseEntity<Void> supprimer(@PathVariable Long id) {
        produitService.supprimer(id);
        return ResponseEntity.noContent().build();
    }
}
