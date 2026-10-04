package com.boutique.backend.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.boutique.backend.model.Role;
import com.boutique.backend.model.Sexe;
import com.boutique.backend.model.Utilisateur;
import com.boutique.backend.service.UtilisateurService;
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
class ProduitControllerTest {

    private static final String RIZ = """
            {"nom":"Riz parfume 5kg","description":"Sac de riz","prixAchat":4500.00,
             "prixVente":5500.00,"unite":"SACHET","quantiteStock":30,"seuilAlerte":5}""";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    UtilisateurService utilisateurService;

    private String jetonGerant;

    @BeforeEach
    void connecterLeGerant() throws Exception {
        jetonGerant = jeton("gerant", "gerant123");
    }

    @Test
    void gerant_cree_un_produit_et_recoit_201() throws Exception {
        mockMvc.perform(post("/api/produits").header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON).content(RIZ))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.nom").value("Riz parfume 5kg"))
                .andExpect(jsonPath("$.enAlerteStock").value(false));
    }

    @Test
    void nom_deja_utilise_retourne_409() throws Exception {
        creerRiz();
        mockMvc.perform(post("/api/produits").header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON).content(RIZ))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.statut").value(409));
    }

    @Test
    void prix_de_vente_inferieur_au_prix_achat_retourne_409() throws Exception {
        mockMvc.perform(post("/api/produits").header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nom":"Huile 1L","prixAchat":1000.00,"prixVente":800.00,
                                 "unite":"LITRE","quantiteStock":10,"seuilAlerte":2}"""))
                .andExpect(status().isConflict());
    }

    @Test
    void champs_manquants_retournent_400_avec_le_detail() throws Exception {
        mockMvc.perform(post("/api/produits").header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"nom":"","prixVente":500.00}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.champs.nom").isNotEmpty())
                .andExpect(jsonPath("$.champs.prixAchat").isNotEmpty())
                .andExpect(jsonPath("$.champs.unite").isNotEmpty());
    }

    @Test
    void recherche_par_nom_ne_remonte_que_les_produits_correspondants() throws Exception {
        creerRiz();
        creer("""
                {"nom":"Sucre en morceaux","prixAchat":800.00,"prixVente":1000.00,
                 "unite":"PAQUET","quantiteStock":12,"seuilAlerte":3}""");

        mockMvc.perform(get("/api/produits").param("nom", "riz")
                        .header("Authorization", "Bearer " + jetonGerant))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].nom").value("Riz parfume 5kg"));
    }

    @Test
    void produit_inexistant_retourne_404() throws Exception {
        mockMvc.perform(get("/api/produits/999999")
                        .header("Authorization", "Bearer " + jetonGerant))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.statut").value(404));
    }

    @Test
    void modification_met_a_jour_le_stock_et_leve_l_alerte() throws Exception {
        long id = creerRiz();

        mockMvc.perform(put("/api/produits/" + id)
                        .header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nom":"Riz parfume 5kg","prixAchat":4500.00,"prixVente":6000.00,
                                 "unite":"SACHET","quantiteStock":2,"seuilAlerte":5}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.prixVente").value(6000.00))
                .andExpect(jsonPath("$.enAlerteStock").value(true));
    }

    @Test
    void suppression_retire_le_produit_du_catalogue() throws Exception {
        long id = creerRiz();

        mockMvc.perform(delete("/api/produits/" + id)
                        .header("Authorization", "Bearer " + jetonGerant))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/produits/" + id)
                        .header("Authorization", "Bearer " + jetonGerant))
                .andExpect(status().isNotFound());
    }

    @Test
    void un_vendeur_peut_consulter_mais_pas_creer() throws Exception {
        utilisateurService.creer(Utilisateur.builder()
                .nom("Kone").prenom("Awa").matricule("MAT-9001")
                .sexe(Sexe.FEMININ).dateNaissance(LocalDate.of(1998, 3, 2))
                .identifiant("vendeuse").role(Role.VENDEUR).build(), "vendeuse123");
        String jetonVendeuse = jeton("vendeuse", "vendeuse123");

        mockMvc.perform(get("/api/produits").header("Authorization", "Bearer " + jetonVendeuse))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/produits").header("Authorization", "Bearer " + jetonVendeuse)
                        .contentType(MediaType.APPLICATION_JSON).content(RIZ))
                .andExpect(status().isForbidden());
    }

    @Test
    void recreer_un_produit_supprime_le_remet_au_catalogue() throws Exception {
        long id = creerRiz();
        mockMvc.perform(delete("/api/produits/" + id)
                .header("Authorization", "Bearer " + jetonGerant)).andExpect(status().isNoContent());

        // Le nom reste unique en base : la recreation doit reactiver la meme ligne,
        // pas echouer en 409 ni creer un doublon.
        mockMvc.perform(post("/api/produits").header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON).content(RIZ))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value((int) id));
    }

    @Test
    void catalogue_refuse_une_requete_sans_jeton() throws Exception {
        mockMvc.perform(get("/api/produits")).andExpect(status().isUnauthorized());
    }

    private long creerRiz() throws Exception {
        return creer(RIZ);
    }

    private long creer(String corps) throws Exception {
        String reponse = mockMvc.perform(post("/api/produits")
                        .header("Authorization", "Bearer " + jetonGerant)
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
