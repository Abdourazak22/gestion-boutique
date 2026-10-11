package com.boutique.backend.dto;

import com.boutique.backend.model.MotifAjustement;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Correction du stock d'un produit après comptage en rayon.
 *
 * <p>On transmet la quantité <em>comptée</em>, pas l'écart : c'est ce que le
 * gérant a sous les yeux. Lui faire calculer « j'en ai 9, le logiciel en
 * annonce 12, je saisis donc moins 3 » serait une soustraction de plus à se
 * tromper, pour rien.
 *
 * <p>Le motif n'est exigé que s'il y a un écart à justifier : un comptage qui
 * confirme le stock mérite d'être enregistré, et n'a rien à expliquer.
 */
public record AjustementStockRequest(
        @NotNull(message = "La quantité comptée est obligatoire")
        @Min(value = 0, message = "La quantité comptée ne peut être négative")
        Integer quantiteComptee,

        MotifAjustement motif,

        @Size(max = 300, message = "Le commentaire ne peut dépasser 300 caractères")
        String commentaire) {
}
