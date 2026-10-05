package com.boutique.backend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.boutique.backend.model.Produit;
import com.boutique.backend.model.UniteMesure;
import com.boutique.backend.repository.AchatRepository;
import com.boutique.backend.repository.ProduitRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
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
 * Sans {@code @Transactional} : les ventes doivent être committées pour que les
 * requêtes d'agrégation les voient.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ModePaiementTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    ProduitRepository produitRepository;

    @Autowired
    AchatRepository achatRepository;

    private String jeton;
    private Long produitId;

    @BeforeEach
    void preparer() throws Exception {
        jeton = jetonGerant();
        produitId = produitRepository.save(Produit.builder()
                .nom("Produit mode paiement")
                .prixAchat(new BigDecimal("1000.00"))
                .prixVente(new BigDecimal("1500.00"))
                .unite(UniteMesure.PIECE)
                .quantiteStock(100)
                .seuilAlerte(2)
                .build()).getId();
    }

    @AfterEach
    void nettoyer() {
        achatRepository.deleteAll();
        produitRepository.deleteAll();
    }

    @Test
    void le_mode_de_paiement_est_enregistre_et_restitue() throws Exception {
        mockMvc.perform(vendre("ORANGE_MONEY", 2))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.modePaiement").value("ORANGE_MONEY"));
    }

    @Test
    void les_quatre_moyens_sont_acceptes() throws Exception {
        for (String mode : new String[] {"ESPECES", "ORANGE_MONEY", "MOOV_MONEY", "CARTE"}) {
            mockMvc.perform(vendre(mode, 1))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.modePaiement").value(mode));
        }
    }

    /** Sans mode de paiement, impossible de savoir ce qui est en caisse le soir. */
    @Test
    void un_achat_sans_mode_de_paiement_est_refuse() throws Exception {
        mockMvc.perform(post("/api/achats").header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"lignes":[{"produitId":%d,"quantite":1}]}""".formatted(produitId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.champs.modePaiement").exists());
    }

    @Test
    void un_mode_de_paiement_inconnu_est_refuse() throws Exception {
        mockMvc.perform(post("/api/achats").header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"modePaiement":"BITCOIN","lignes":[{"produitId":%d,"quantite":1}]}"""
                                .formatted(produitId)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void le_ticket_imprime_le_moyen_de_reglement() throws Exception {
        String reponse = mockMvc.perform(vendre("MOOV_MONEY", 1))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long achatId = objectMapper.readTree(reponse).get("id").asLong();

        byte[] pdf = mockMvc.perform(get("/api/achats/" + achatId + "/ticket")
                        .header("Authorization", "Bearer " + jeton))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();

        String texte = new org.apache.pdfbox.text.PDFTextStripper()
                .getText(org.apache.pdfbox.Loader.loadPDF(pdf));

        assertThat(texte).contains("Paiement");
        // Le libelle est lisible, pas la constante de l'enumeration.
        assertThat(texte).contains("Moov Money");
        assertThat(texte).doesNotContain("MOOV_MONEY");
    }

    /**
     * Le chiffre du soir : ce qui doit etre dans le tiroir et ce qui est arrive
     * sur chaque portefeuille mobile.
     */
    @Test
    void les_statistiques_ventilent_les_encaissements_par_moyen() throws Exception {
        mockMvc.perform(vendre("ESPECES", 2)).andExpect(status().isCreated());
        mockMvc.perform(vendre("ESPECES", 1)).andExpect(status().isCreated());
        mockMvc.perform(vendre("ORANGE_MONEY", 4)).andExpect(status().isCreated());

        mockMvc.perform(get("/api/statistiques")
                        .param("du", LocalDate.now().toString())
                        .param("au", LocalDate.now().toString())
                        .header("Authorization", "Bearer " + jeton))
                .andExpect(status().isOk())
                // Trie par montant decroissant : Orange Money (6 000) devance
                // les especes (3 x 1 500 = 4 500).
                .andExpect(jsonPath("$.ventesParMode.length()").value(2))
                .andExpect(jsonPath("$.ventesParMode[0].mode").value("ORANGE_MONEY"))
                .andExpect(jsonPath("$.ventesParMode[0].nombre").value(1))
                .andExpect(jsonPath("$.ventesParMode[0].montant").value(6000.00))
                .andExpect(jsonPath("$.ventesParMode[1].mode").value("ESPECES"))
                .andExpect(jsonPath("$.ventesParMode[1].nombre").value(2))
                .andExpect(jsonPath("$.ventesParMode[1].montant").value(4500.00));
    }

    @Test
    void une_periode_sans_vente_ne_ventile_rien() throws Exception {
        mockMvc.perform(get("/api/statistiques")
                        .param("du", "2000-01-01").param("au", "2000-01-31")
                        .header("Authorization", "Bearer " + jeton))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ventesParMode.length()").value(0));
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
            vendre(String mode, int quantite) {
        return post("/api/achats").header("Authorization", "Bearer " + jeton)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"modePaiement":"%s","lignes":[{"produitId":%d,"quantite":%d}]}"""
                        .formatted(mode, produitId, quantite));
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
