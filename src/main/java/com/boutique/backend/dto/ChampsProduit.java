package com.boutique.backend.dto;

import com.boutique.backend.model.UniteMesure;
import java.math.BigDecimal;

/**
 * Champs de la fiche d'un produit, communs à sa création et à sa modification.
 *
 * <p>Les deux requêtes ne diffèrent que par le stock : saisi à la création, où
 * il devient le premier mouvement du journal, refusé à la modification. Tout
 * le reste était recopié, et {@code ProduitService} affectait donc deux fois
 * les six mêmes champs.
 */
public interface ChampsProduit {

    String nom();

    String description();

    BigDecimal prixAchat();

    BigDecimal prixVente();

    UniteMesure unite();

    Integer seuilAlerte();
}
