package com.boutique.backend.dto;

import com.boutique.backend.model.MotifAjustement;
import com.boutique.backend.model.MouvementStock;
import com.boutique.backend.model.TypeMouvement;
import java.time.Instant;

/**
 * Une ligne de l'historique de stock d'un produit.
 *
 * <p>La date est un {@link Instant} et non un {@code LocalDateTime} comme sur
 * les ventes : un instant sérialisé en UTC est sans ambiguïté, alors qu'une
 * date-heure nue dépend du fuseau de qui la lit. Les deux coïncident au
 * Burkina, qui est à UTC+0, mais autant ne pas en dépendre.
 */
public record MouvementStockResponse(
        Long id,
        TypeMouvement type,
        int variation,
        int stockAvant,
        int stockApres,
        MotifAjustement motif,
        String commentaire,
        String reference,
        String auteur,
        Instant date) {

    public static MouvementStockResponse de(MouvementStock mouvement) {
        return new MouvementStockResponse(
                mouvement.getId(),
                mouvement.getType(),
                mouvement.getVariation(),
                mouvement.getStockAvant(),
                mouvement.getStockApres(),
                mouvement.getMotif(),
                mouvement.getCommentaire(),
                mouvement.getReference(),
                // Nul pour la reprise de stock antérieure au journal.
                mouvement.getAuteur() == null ? null
                        : mouvement.getAuteur().getPrenom() + " " + mouvement.getAuteur().getNom(),
                mouvement.getCreeLe());
    }
}
