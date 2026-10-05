package com.boutique.backend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.ByteArrayInputStream;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class TicketTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    private String jeton;
    private long achatId;

    @BeforeEach
    void vendre() throws Exception {
        jeton = jetonGerant();
        long rizId = creerProduit("""
                {"nom":"Riz ticket 5kg","prixAchat":4500.00,"prixVente":5500.00,
                 "unite":"SACHET","quantiteStock":20,"seuilAlerte":5}""");
        long sucreId = creerProduit("""
                {"nom":"Sucre ticket 1kg","prixAchat":800.00,"prixVente":1000.00,
                 "unite":"PAQUET","quantiteStock":10,"seuilAlerte":2}""");

        String reponse = mockMvc.perform(post("/api/achats")
                        .header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"modePaiement":"ESPECES","nomClient":"Awa Kone",
                                 "lignes":[{"produitId":%d,"quantite":3},
                                           {"produitId":%d,"quantite":2}]}"""
                                .formatted(rizId, sucreId)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        achatId = objectMapper.readTree(reponse).get("id").asLong();
    }

    @Test
    void le_ticket_est_un_pdf_servi_en_inline() throws Exception {
        mockMvc.perform(get("/api/achats/" + achatId + "/ticket")
                        .header("Authorization", "Bearer " + jeton))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", MediaType.APPLICATION_PDF_VALUE))
                .andExpect(header().string("Content-Disposition",
                        org.hamcrest.Matchers.allOf(
                                org.hamcrest.Matchers.startsWith("inline"),
                                org.hamcrest.Matchers.containsString("ticket-ACH-"))));
    }

    @Test
    void le_pdf_contient_les_lignes_le_total_et_l_entete() throws Exception {
        byte[] pdf = mockMvc.perform(get("/api/achats/" + achatId + "/ticket")
                        .header("Authorization", "Bearer " + jeton))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();

        String texte = extraire(pdf);

        assertThat(texte).contains("BOUTIQUE TEST");
        assertThat(texte).contains("Riz ticket 5kg");
        assertThat(texte).contains("Sucre ticket 1kg");
        assertThat(texte).contains("Awa Kone");
        assertThat(texte).contains("Gerant Ouattara");
        // 3 x 5500 + 2 x 1000 = 18 500, formate avec une espace de groupement
        assertThat(texte).contains("18 500");
        assertThat(texte).contains("TOTAL FCFA");
        assertThat(texte).contains("Merci de votre visite");
    }

    @Test
    void la_largeur_de_page_est_celle_d_une_imprimante_58_mm() throws Exception {
        byte[] pdf = mockMvc.perform(get("/api/achats/" + achatId + "/ticket")
                        .header("Authorization", "Bearer " + jeton))
                .andReturn().getResponse().getContentAsByteArray();

        try (PDDocument document = Loader.loadPDF(pdf)) {
            float largeur = document.getPage(0).getMediaBox().getWidth();
            // 58 mm = 164,4 points
            assertThat(largeur).isCloseTo(164.4f, org.assertj.core.data.Offset.offset(0.5f));
            assertThat(document.getNumberOfPages()).isEqualTo(1);
        }
    }

    @Test
    void ticket_d_un_achat_inexistant_retourne_404() throws Exception {
        mockMvc.perform(get("/api/achats/999999/ticket")
                        .header("Authorization", "Bearer " + jeton))
                .andExpect(status().isNotFound());
    }

    @Test
    void ticket_refuse_une_requete_sans_jeton() throws Exception {
        mockMvc.perform(get("/api/achats/" + achatId + "/ticket"))
                .andExpect(status().isUnauthorized());
    }

    private String extraire(byte[] pdf) throws Exception {
        try (PDDocument document = Loader.loadPDF(pdf)) {
            return new PDFTextStripper().getText(document);
        }
    }

    private long creerProduit(String corps) throws Exception {
        String reponse = mockMvc.perform(post("/api/produits")
                        .header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON).content(corps))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(reponse).get("id").asLong();
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
