package com.boutique.backend.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
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
class AchatControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    private String jeton;
    private long rizId;

    @BeforeEach
    void preparerCatalogue() throws Exception {
        jeton = jetonGerant();
        rizId = creerProduit("""
                {"nom":"Riz parfume 5kg","prixAchat":4500.00,"prixVente":5500.00,
                 "unite":"SACHET","quantiteStock":20,"seuilAlerte":5}""");
    }

    @Test
    void vente_de_deux_produits_decremente_le_stock_et_calcule_le_total() throws Exception {
        long sucreId = creerProduit("""
                {"nom":"Sucre 1kg","prixAchat":800.00,"prixVente":1000.00,
                 "unite":"PAQUET","quantiteStock":10,"seuilAlerte":2}""");

        mockMvc.perform(post("/api/achats").header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"modePaiement":"ESPECES","nomClient":"Awa Kone","telephoneClient":"0700000000",
                                 "lignes":[{"produitId":%d,"quantite":3},
                                           {"produitId":%d,"quantite":2}]}"""
                                .formatted(rizId, sucreId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.numero").value(org.hamcrest.Matchers.startsWith("ACH-")))
                .andExpect(jsonPath("$.lignes.length()").value(2))
                // 3 x 5500 + 2 x 1000 = 18500
                .andExpect(jsonPath("$.montantTotal").value(18500.00))
                .andExpect(jsonPath("$.vendeur").value("Gerant Ouattara"));

        mockMvc.perform(get("/api/produits/" + rizId).header("Authorization", "Bearer " + jeton))
                .andExpect(jsonPath("$.quantiteStock").value(17));
        mockMvc.perform(get("/api/produits/" + sucreId).header("Authorization", "Bearer " + jeton))
                .andExpect(jsonPath("$.quantiteStock").value(8));
    }

    @Test
    void stock_insuffisant_retourne_409() throws Exception {
        long sucreId = creerProduit("""
                {"nom":"Sucre 1kg","prixAchat":800.00,"prixVente":1000.00,
                 "unite":"PAQUET","quantiteStock":10,"seuilAlerte":2}""");

        // Le rollback du stock est verifie par AchatRollbackTest : ici le test est
        // @Transactional, donc la requete rejoint sa transaction et aucun rollback
        // n'est observable.
        mockMvc.perform(post("/api/achats").header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"modePaiement":"ESPECES","lignes":[{"produitId":%d,"quantite":2},
                                           {"produitId":%d,"quantite":999}]}"""
                                .formatted(rizId, sucreId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message")
                        .value(org.hamcrest.Matchers.containsString("Stock insuffisant")));
    }

    @Test
    void achat_sans_ligne_retourne_400() throws Exception {
        mockMvc.perform(post("/api/achats").header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"modePaiement":"ESPECES","nomClient":"Awa","lignes":[]}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.champs.lignes").isNotEmpty());
    }

    @Test
    void quantite_nulle_retourne_400() throws Exception {
        mockMvc.perform(post("/api/achats").header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"modePaiement":"ESPECES","lignes":[{"produitId":%d,"quantite":0}]}""".formatted(rizId)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void produit_repete_dans_le_meme_achat_retourne_409() throws Exception {
        mockMvc.perform(post("/api/achats").header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"modePaiement":"ESPECES","lignes":[{"produitId":%d,"quantite":1},
                                           {"produitId":%d,"quantite":2}]}"""
                                .formatted(rizId, rizId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message")
                        .value(org.hamcrest.Matchers.containsString("plusieurs fois")));
    }

    @Test
    void produit_inexistant_retourne_404() throws Exception {
        mockMvc.perform(post("/api/achats").header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"modePaiement":"ESPECES","lignes":[{"produitId":999999,"quantite":1}]}"""))
                .andExpect(status().isNotFound());
    }

    @Test
    void le_prix_de_la_ligne_est_fige_a_la_vente() throws Exception {
        long achatId = vendre(rizId, 1);

        // Le produit change de prix apres la vente...
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/produits/" + rizId)
                        .header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        // Plus de quantiteStock a tenir a jour ici : la modification
                        // d'un produit ne touche plus a son stock.
                        .content("""
                                {"nom":"Riz parfume 5kg","prixAchat":4500.00,"prixVente":9999.00,
                                 "unite":"SACHET","seuilAlerte":5}"""))
                .andExpect(status().isOk());

        // ... mais l'historique garde le prix d'origine.
        mockMvc.perform(get("/api/achats/" + achatId).header("Authorization", "Bearer " + jeton))
                .andExpect(jsonPath("$.lignes[0].prixUnitaire").value(5500.00))
                .andExpect(jsonPath("$.montantTotal").value(5500.00));
    }

    @Test
    void historique_remonte_les_achats_du_jour() throws Exception {
        vendre(rizId, 1);
        String aujourdhui = LocalDate.now().toString();

        mockMvc.perform(get("/api/achats").param("du", aujourdhui).param("au", aujourdhui)
                        .header("Authorization", "Bearer " + jeton))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].lignes[0].nomProduit").value("Riz parfume 5kg"));
    }

    @Test
    void historique_hors_plage_est_vide() throws Exception {
        vendre(rizId, 1);

        mockMvc.perform(get("/api/achats").param("du", "2020-01-01").param("au", "2020-12-31")
                        .header("Authorization", "Bearer " + jeton))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0));
    }

    @Test
    void historique_refuse_une_requete_sans_jeton() throws Exception {
        mockMvc.perform(get("/api/achats")).andExpect(status().isUnauthorized());
    }

    private long vendre(long produitId, int quantite) throws Exception {
        String reponse = mockMvc.perform(post("/api/achats")
                        .header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"modePaiement":"ESPECES","lignes":[{"produitId":%d,"quantite":%d}]}"""
                                .formatted(produitId, quantite)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(reponse).get("id").asLong();
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
