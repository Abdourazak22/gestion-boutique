package com.boutique.backend.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
class AuthControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Test
    void connexion_avec_bons_identifiants_retourne_un_jeton() throws Exception {
        mockMvc.perform(post("/api/auth/connexion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"identifiant":"gerant","motDePasse":"gerant123"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jeton").isNotEmpty())
                .andExpect(jsonPath("$.typeJeton").value("Bearer"))
                .andExpect(jsonPath("$.utilisateur.identifiant").value("gerant"))
                .andExpect(jsonPath("$.utilisateur.role").value("GERANT"));
    }

    @Test
    void connexion_avec_mauvais_mot_de_passe_retourne_401() throws Exception {
        mockMvc.perform(post("/api/auth/connexion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"identifiant":"gerant","motDePasse":"mauvais"}"""))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Identifiant ou mot de passe incorrect"));
    }

    @Test
    void connexion_sans_identifiant_retourne_400() throws Exception {
        mockMvc.perform(post("/api/auth/connexion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"identifiant":"","motDePasse":"gerant123"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.champs.identifiant").isNotEmpty());
    }

    @Test
    void endpoint_protege_refuse_une_requete_sans_jeton() throws Exception {
        mockMvc.perform(get("/api/auth/moi"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void endpoint_protege_accepte_le_jeton_emis_par_la_connexion() throws Exception {
        mockMvc.perform(get("/api/auth/moi").header("Authorization", "Bearer " + jetonGerant()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.identifiant").value("gerant"));
    }

    private String jetonGerant() throws Exception {
        String reponse = mockMvc.perform(post("/api/auth/connexion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"identifiant":"gerant","motDePasse":"gerant123"}"""))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(reponse).get("jeton").asText();
    }
}
