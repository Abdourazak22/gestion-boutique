package com.boutique.backend.dto;

import com.boutique.backend.model.MotifAnnulation;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Annulation d'une vente.
 *
 * @param motif         pourquoi, de façon dénombrable
 * @param commentaire   détail libre, facultatif
 * @param retourEnStock la marchandise retourne-t-elle en rayon ? Une erreur de
 *                      saisie, oui : les articles n'ont jamais quitté la
 *                      boutique. Un produit abîmé, non : le remettre en stock
 *                      ferait croire à de la marchandise vendable. Le choix est
 *                      explicite plutôt que déduit du motif, parce que la
 *                      réalité ne suit pas toujours la règle.
 */
public record AnnulationRequest(
        @NotNull(message = "Le motif de l'annulation est obligatoire")
        MotifAnnulation motif,

        @Size(max = 300, message = "Le commentaire ne peut dépasser 300 caractères")
        String commentaire,

        @NotNull(message = "Il faut préciser si la marchandise retourne en stock")
        Boolean retourEnStock) {
}
