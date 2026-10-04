package com.boutique.backend.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.boutique.backend.model.Role;
import com.boutique.backend.model.Sexe;
import com.boutique.backend.model.Utilisateur;
import com.boutique.backend.service.UtilisateurService;
import java.time.LocalDate;
import org.hamcrest.Matchers;
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
class LivraisonControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    UtilisateurService utilisateurService;

    private String jeton;
    private long rizId;

    @BeforeEach
    void preparerCatalogue() throws Exception {
        jeton = jeton("gerant", "gerant123");
        rizId = creerProduit("""
                {"nom":"Riz parfume 5kg","prixAchat":4500.00,"prixVente":5500.00,
                 "unite":"SACHET","quantiteStock":10,"seuilAlerte":5}""");
    }

    @Test
    void livraison_incremente_le_stock_et_calcule_le_total() throws Exception {
        mockMvc.perform(post("/api/livraisons").header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nomGrossiste":"Ets Traore","referenceBon":"BL-4421",
                                 "lignes":[{"produitId":%d,"quantite":50,"prixUnitaire":4300.00}]}"""
                                .formatted(rizId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.numero").value(Matchers.startsWith("LIV-")))
                .andExpect(jsonPath("$.nomGrossiste").value("Ets Traore"))
                // 50 x 4300 = 215000
                .andExpect(jsonPath("$.montantTotal").value(215000.00))
                .andExpect(jsonPath("$.receptionniste").value("Gerant Ouattara"));

        mockMvc.perform(get("/api/produits/" + rizId).header("Authorization", "Bearer " + jeton))
                .andExpect(jsonPath("$.quantiteStock").value(60));
    }

    @Test
    void prix_unitaire_absent_reprend_le_prix_achat_du_produit() throws Exception {
        mockMvc.perform(post("/api/livraisons").header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nomGrossiste":"Ets Traore",
                                 "lignes":[{"produitId":%d,"quantite":10}]}""".formatted(rizId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.lignes[0].prixUnitaire").value(4500.00))
                .andExpect(jsonPath("$.montantTotal").value(45000.00));
    }

    @Test
    void grossiste_manquant_retourne_400() throws Exception {
        mockMvc.perform(post("/api/livraisons").header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nomGrossiste":"",
                                 "lignes":[{"produitId":%d,"quantite":10}]}""".formatted(rizId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.champs.nomGrossiste").isNotEmpty());
    }

    @Test
    void livraison_sans_ligne_retourne_400() throws Exception {
        mockMvc.perform(post("/api/livraisons").header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nomGrossiste":"Ets Traore","lignes":[]}"""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void produit_inexistant_retourne_404() throws Exception {
        mockMvc.perform(post("/api/livraisons").header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nomGrossiste":"Ets Traore",
                                 "lignes":[{"produitId":999999,"quantite":10}]}"""))
                .andExpect(status().isNotFound());
    }

    @Test
    void un_vendeur_ne_peut_pas_enregistrer_une_livraison() throws Exception {
        utilisateurService.creer(Utilisateur.builder()
                .nom("Kone").prenom("Awa").matricule("MAT-9002")
                .sexe(Sexe.FEMININ).dateNaissance(LocalDate.of(1998, 3, 2))
                .identifiant("vendeuse2").role(Role.VENDEUR).build(), "vendeuse123");
        String jetonVendeuse = jeton("vendeuse2", "vendeuse123");

        mockMvc.perform(post("/api/livraisons").header("Authorization", "Bearer " + jetonVendeuse)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nomGrossiste":"Ets Traore",
                                 "lignes":[{"produitId":%d,"quantite":10}]}""".formatted(rizId)))
                .andExpect(status().isForbidden());

        // En revanche il consulte l'historique sans probleme.
        mockMvc.perform(get("/api/livraisons").header("Authorization", "Bearer " + jetonVendeuse))
                .andExpect(status().isOk());
    }

    @Test
    void historique_remonte_les_livraisons_du_jour() throws Exception {
        livrer(rizId, 25);
        String aujourdhui = LocalDate.now().toString();

        mockMvc.perform(get("/api/livraisons").param("du", aujourdhui).param("au", aujourdhui)
                        .header("Authorization", "Bearer " + jeton))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].lignes[0].quantite").value(25));
    }

    @Test
    void plage_de_dates_inversee_retourne_409() throws Exception {
        mockMvc.perform(get("/api/livraisons").param("du", "2026-12-31").param("au", "2026-01-01")
                        .header("Authorization", "Bearer " + jeton))
                .andExpect(status().isConflict());
    }

    @Test
    void livraison_inexistante_retourne_404() throws Exception {
        mockMvc.perform(get("/api/livraisons/999999").header("Authorization", "Bearer " + jeton))
                .andExpect(status().isNotFound());
    }

    @Test
    void historique_refuse_une_requete_sans_jeton() throws Exception {
        mockMvc.perform(get("/api/livraisons")).andExpect(status().isUnauthorized());
    }

    private long livrer(long produitId, int quantite) throws Exception {
        String reponse = mockMvc.perform(post("/api/livraisons")
                        .header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nomGrossiste":"Ets Traore",
                                 "lignes":[{"produitId":%d,"quantite":%d}]}"""
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

    private String jeton(String identifiant, String motDePasse) throws Exception {
        String reponse = mockMvc.perform(post("/api/auth/connexion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identifiant\":\"%s\",\"motDePasse\":\"%s\"}"
                                .formatted(identifiant, motDePasse)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(reponse).get("jeton").asText();
    }
}
