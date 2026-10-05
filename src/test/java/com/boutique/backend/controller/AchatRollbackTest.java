package com.boutique.backend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.boutique.backend.model.Produit;
import com.boutique.backend.model.UniteMesure;
import com.boutique.backend.repository.AchatRepository;
import com.boutique.backend.repository.ProduitRepository;
import java.math.BigDecimal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

/**
 * Volontairement SANS {@code @Transactional} : les requêtes doivent committer pour
 * de vrai, sinon le rollback déclenché par le service est invisible. Le nettoyage
 * est donc explicite.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AchatRollbackTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    ProduitRepository produitRepository;

    @Autowired
    AchatRepository achatRepository;

    private String jeton;
    private Long rizId;
    private Long sucreId;

    @BeforeEach
    void preparer() throws Exception {
        jeton = jetonGerant();
        rizId = enregistrer("Riz rollback", 20);
        sucreId = enregistrer("Sucre rollback", 10);
    }

    @AfterEach
    void nettoyer() {
        achatRepository.deleteAll();
        produitRepository.deleteAll();
    }

    @Test
    void un_stock_insuffisant_sur_la_derniere_ligne_annule_tout_l_achat() throws Exception {
        long achatsAvant = achatRepository.count();

        mockMvc.perform(post("/api/achats").header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"modePaiement":"ESPECES","lignes":[{"produitId":%d,"quantite":2},
                                           {"produitId":%d,"quantite":999}]}"""
                                .formatted(rizId, sucreId)))
                .andExpect(status().isConflict());

        assertThat(produitRepository.findById(rizId).orElseThrow().getQuantiteStock())
                .as("le stock de la 1re ligne doit etre revenu a sa valeur initiale")
                .isEqualTo(20);
        assertThat(achatRepository.count())
                .as("aucun achat ne doit avoir ete enregistre")
                .isEqualTo(achatsAvant);
    }

    @Test
    void un_achat_valide_est_bien_committe() throws Exception {
        mockMvc.perform(post("/api/achats").header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"modePaiement":"ESPECES","lignes":[{"produitId":%d,"quantite":2}]}""".formatted(rizId)))
                .andExpect(status().isCreated());

        assertThat(produitRepository.findById(rizId).orElseThrow().getQuantiteStock())
                .isEqualTo(18);
        assertThat(achatRepository.count()).isEqualTo(1);
    }

    private Long enregistrer(String nom, int stock) {
        return produitRepository.save(Produit.builder()
                .nom(nom)
                .prixAchat(new BigDecimal("1000.00"))
                .prixVente(new BigDecimal("1500.00"))
                .unite(UniteMesure.PIECE)
                .quantiteStock(stock)
                .seuilAlerte(2)
                .build()).getId();
    }

    private String jetonGerant() throws Exception {
        String reponse = mockMvc.perform(post("/api/auth/connexion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"identifiant":"gerant","motDePasse":"gerant123"}"""))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(reponse).get("jeton").asText();
    }
}
