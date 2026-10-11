package com.boutique.backend.dto;

import com.boutique.backend.model.UniteMesure;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Null;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * Modification d'un produit. La quantité en stock n'y figure volontairement
 * pas.
 *
 * <p>Elle y figurait, et c'était un défaut grave : le formulaire renvoyait la
 * quantité lue à son ouverture, et l'enregistrement l'écrivait en valeur
 * absolue. Une vente saisie entre-temps par un autre utilisateur était donc
 * silencieusement effacée du stock. Le verrou optimiste du produit ne protège
 * pas de ce cas : il compare la version relue côté serveur, et le navigateur
 * n'envoie aucune version.
 *
 * <p>Le stock ne change désormais que par un mouvement enregistré : vente,
 * livraison, annulation, ou ajustement d'inventaire.
 */
public record ProduitUpdateRequest(
        @NotBlank(message = "Le nom est obligatoire")
        @Size(max = 120, message = "Le nom ne peut dépasser 120 caractères")
        String nom,

        @Size(max = 500, message = "La description ne peut dépasser 500 caractères")
        String description,

        @NotNull(message = "Le prix d'achat est obligatoire")
        @DecimalMin(value = "0.0", message = "Le prix d'achat ne peut être négatif")
        @Digits(integer = 10, fraction = 2, message = "Le prix d'achat doit avoir au plus 2 décimales")
        BigDecimal prixAchat,

        @NotNull(message = "Le prix de vente est obligatoire")
        @DecimalMin(value = "0.0", message = "Le prix de vente ne peut être négatif")
        @Digits(integer = 10, fraction = 2, message = "Le prix de vente doit avoir au plus 2 décimales")
        BigDecimal prixVente,

        @NotNull(message = "L'unité de mesure est obligatoire")
        UniteMesure unite,

        @NotNull(message = "Le seuil d'alerte est obligatoire")
        @Min(value = 0, message = "Le seuil d'alerte ne peut être négatif")
        Integer seuilAlerte,

        /**
         * Présent uniquement pour être refusé.
         *
         * <p>Sans ce champ, Jackson écarterait « quantiteStock » en silence et
         * répondrait 200 : un onglet resté ouvert sur l'ancienne version du
         * formulaire croirait avoir corrigé le stock sans que rien ne bouge.
         * Mieux vaut une erreur qui dit où corriger le stock.
         */
        @Null(message = "Le stock ne se modifie pas ici : utiliser l'ajustement d'inventaire")
        Integer quantiteStock) implements ChampsProduit {
}
