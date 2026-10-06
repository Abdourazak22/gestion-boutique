package com.boutique.backend.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.boutique.backend.model.Achat;
import com.boutique.backend.repository.AchatRepository;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * La dernière seconde de la journée.
 *
 * <p>Les bornes de période étaient calculées avec {@code atTime(23, 59, 59)}.
 * Les colonnes étant en {@code timestamp(6)}, tout ce qui tombait entre
 * 23:59:59,000001 et 23:59:59,999999 restait dehors : la vente disparaissait
 * de l'historique du jour, et surtout du chiffre d'affaires et de la marge du
 * tableau de bord. Une recette perdue en silence.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class BornesDeJourneeTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    AchatRepository achatRepository;

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
    void une_vente_de_la_derniere_seconde_reste_dans_l_historique_du_jour() throws Exception {
        LocalDate aujourdhui = LocalDate.now();
        vendreALaDerniereFraction(aujourdhui);

        mockMvc.perform(get("/api/achats")
                        .param("du", aujourdhui.toString())
                        .param("au", aujourdhui.toString())
                        .header("Authorization", "Bearer " + jeton))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1));
    }

    @Test
    void une_vente_de_la_derniere_seconde_compte_dans_le_chiffre_d_affaires() throws Exception {
        LocalDate aujourdhui = LocalDate.now();
        vendreALaDerniereFraction(aujourdhui);

        mockMvc.perform(get("/api/statistiques")
                        .param("du", aujourdhui.toString())
                        .param("au", aujourdhui.toString())
                        .header("Authorization", "Bearer " + jeton))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ventes.nombre").value(1))
                // 2 x 5500
                .andExpect(jsonPath("$.ventes.chiffreAffaires").value(11000.00))
                // 2 x (5500 - 4500)
                .andExpect(jsonPath("$.ventes.marge").value(2000.00));
    }

    /**
     * Enregistre une vente puis repousse son horodatage au tout dernier instant
     * représentable de la journée. Le service l'horodate à {@code now()} : il
     * n'y a pas d'autre moyen d'atteindre cette fenêtre depuis l'API.
     */
    private void vendreALaDerniereFraction(LocalDate jour) throws Exception {
        mockMvc.perform(post("/api/achats").header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"modePaiement":"ESPECES",
                                 "lignes":[{"produitId":%d,"quantite":2}]}""".formatted(rizId)))
                .andExpect(status().isCreated());

        Achat achat = achatRepository.findAll().get(0);
        achat.setDateAchat(jour.atTime(LocalTime.MAX).minusNanos(1_000));
        achatRepository.saveAndFlush(achat);
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
                        .content("{\"identifiant\":\"gerant\",\"motDePasse\":\"gerant123\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(reponse).get("jeton").asText();
    }
}
