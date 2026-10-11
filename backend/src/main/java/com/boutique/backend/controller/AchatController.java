package com.boutique.backend.controller;

import com.boutique.backend.dto.AchatRequest;
import com.boutique.backend.dto.AchatResponse;
import com.boutique.backend.dto.AnnulationRequest;
import com.boutique.backend.dto.FichierExport;
import com.boutique.backend.dto.TicketPdf;
import com.boutique.backend.service.AchatService;
import com.boutique.backend.service.ExportComptableService;
import com.boutique.backend.service.TicketService;
import jakarta.validation.Valid;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.web.PagedModel;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/achats")
public class AchatController {

    private final AchatService achatService;
    private final TicketService ticketService;
    private final ExportComptableService exportComptableService;

    public AchatController(AchatService achatService, TicketService ticketService,
                           ExportComptableService exportComptableService) {
        this.achatService = achatService;
        this.ticketService = ticketService;
        this.exportComptableService = exportComptableService;
    }

    /** Enregistre une vente. Le vendeur est déduit du jeton, pas du corps de la requête. */
    @PostMapping
    public ResponseEntity<AchatResponse> enregistrer(@Valid @RequestBody AchatRequest requete,
                                                     @AuthenticationPrincipal Jwt jwt) {
        AchatResponse achat = achatService.enregistrer(requete, jwt.getSubject());
        return ResponseEntity.created(URI.create("/api/achats/" + achat.id())).body(achat);
    }

    /** Historique des achats, filtrable sur une plage de dates. */
    @GetMapping
    public PagedModel<AchatResponse> historique(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate du,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate au,
            @PageableDefault(size = 20, sort = "dateAchat", direction = Sort.Direction.DESC)
            Pageable pagination) {
        return new PagedModel<>(achatService.historique(du, au, pagination));
    }

    @GetMapping("/{id}")
    public AchatResponse detail(@PathVariable Long id) {
        return achatService.parId(id);
    }

    /**
     * Annule une vente et, au choix, lui rend son stock.
     *
     * Réservé au gérant : laisser un vendeur annuler ses propres encaissements
     * ouvre la porte au détournement, puisque la vente disparaîtrait du chiffre
     * d'affaires sans que l'argent revienne en caisse. En boutique, on appelle
     * le gérant.
     */
    @PatchMapping("/{id}/annulation")
    @PreAuthorize("hasRole('GERANT')")
    public AchatResponse annuler(@PathVariable Long id,
                                 @Valid @RequestBody AnnulationRequest requete,
                                 @AuthenticationPrincipal Jwt jwt) {
        return achatService.annuler(id, requete, jwt.getSubject());
    }

    /**
     * Export CSV des ventes de la période, pour la comptabilité.
     *
     * <p>Réservé au gérant : le fichier porte la marge de chaque vente, que
     * {@code StatistiquesController} réserve déjà au même rôle.
     *
     * <p>Servi en {@code attachment} et non {@code inline} : on veut un fichier
     * sur le disque, pas un affichage dans l'onglet.
     */
    @GetMapping(value = "/export", produces = "text/csv")
    @PreAuthorize("hasRole('GERANT')")
    public ResponseEntity<byte[]> exporter(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate du,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate au) {
        FichierExport fichier = exportComptableService.ventes(du, au);
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(fichier.nomFichier()).build().toString())
                .body(fichier.contenu());
    }

    /**
     * Ticket de caisse au format PDF, au gabarit 58 mm. Servi en {@code inline}
     * pour que le navigateur l'ouvre directement dans sa visionneuse, prêt à imprimer.
     */
    @GetMapping(value = "/{id}/ticket", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> ticket(@PathVariable Long id) {
        TicketPdf ticket = ticketService.ticketPdf(id);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename(ticket.nomFichier()).build().toString())
                .body(ticket.contenu());
    }
}
