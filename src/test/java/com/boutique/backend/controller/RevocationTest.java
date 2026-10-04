package com.boutique.backend.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
 * Révocation des jetons. Un JWT est autoporteur : sans ces contrôles, tout
 * changement de droits ne prendrait effet qu'à l'expiration du jeton.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class RevocationTest {

    private static final String VENDEUSE = """
            {"nom":"Kone","prenom":"Awa","matricule":"MAT-6001","sexe":"FEMININ",
             "dateNaissance":"1998-03-02","identifiant":"awa.revoc",
             "motDePasse":"motdepasse1","role":"VENDEUR"}""";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    private String jetonGerant;
    private long idVendeuse;
    private String jetonVendeuse;

    @BeforeEach
    void preparer() throws Exception {
        jetonGerant = jeton("gerant", "gerant123");
        idVendeuse = objectMapper.readTree(mockMvc.perform(post("/api/utilisateurs")
                        .header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON).content(VENDEUSE))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();
        jetonVendeuse = jeton("awa.revoc", "motdepasse1");
    }

    @Test
    void le_jeton_fonctionne_avant_toute_revocation() throws Exception {
        mockMvc.perform(get("/api/auth/moi").header("Authorization", "Bearer " + jetonVendeuse))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.identifiant").value("awa.revoc"));
    }

    @Test
    void changer_de_mot_de_passe_invalide_les_jetons_en_cours() throws Exception {
        mockMvc.perform(patch("/api/auth/mot-de-passe")
                        .header("Authorization", "Bearer " + jetonVendeuse)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"motDePasseActuel":"motdepasse1",
                                 "nouveauMotDePasse":"nouveaupass1"}"""))
                .andExpect(status().isNoContent());

        // Le jeton utilise pour faire le changement ne vaut plus rien lui non plus.
        mockMvc.perform(get("/api/auth/moi").header("Authorization", "Bearer " + jetonVendeuse))
                .andExpect(status().isUnauthorized());

        // Et le jeton obtenu apres reconnexion fonctionne.
        mockMvc.perform(get("/api/auth/moi")
                        .header("Authorization", "Bearer " + jeton("awa.revoc", "nouveaupass1")))
                .andExpect(status().isOk());
    }

    @Test
    void desactiver_un_compte_coupe_l_acces_immediatement() throws Exception {
        mockMvc.perform(patch("/api/utilisateurs/" + idVendeuse + "/statut")
                        .header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"actif":false}"""))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/produits").header("Authorization", "Bearer " + jetonVendeuse))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void retrograder_un_gerant_lui_retire_ses_droits_sans_attendre() throws Exception {
        // Un second gerant, pour ne pas buter sur le garde-fou du dernier gerant.
        long idSecond = objectMapper.readTree(mockMvc.perform(post("/api/utilisateurs")
                        .header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nom":"Traore","prenom":"Moussa","matricule":"MAT-6002",
                                 "sexe":"MASCULIN","dateNaissance":"1990-05-05",
                                 "identifiant":"moussa.revoc","motDePasse":"motdepasse1",
                                 "role":"GERANT"}"""))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();
        String jetonSecond = jeton("moussa.revoc", "motdepasse1");

        mockMvc.perform(get("/api/utilisateurs").header("Authorization", "Bearer " + jetonSecond))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/utilisateurs/" + idSecond)
                        .header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nom":"Traore","prenom":"Moussa","matricule":"MAT-6002",
                                 "sexe":"MASCULIN","dateNaissance":"1990-05-05",
                                 "role":"VENDEUR"}"""))
                .andExpect(status().isOk());

        // Son ancien jeton portait roles=[GERANT] : il doit etre refuse, pas
        // seulement ignore.
        mockMvc.perform(get("/api/utilisateurs").header("Authorization", "Bearer " + jetonSecond))
                .andExpect(status().isUnauthorized());

        // Apres reconnexion, il est bien vendeur.
        mockMvc.perform(get("/api/utilisateurs")
                        .header("Authorization", "Bearer " + jeton("moussa.revoc", "motdepasse1")))
                .andExpect(status().isForbidden());
    }

    @Test
    void une_modification_sans_changement_de_role_ne_revoque_pas() throws Exception {
        mockMvc.perform(put("/api/utilisateurs/" + idVendeuse)
                        .header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nom":"Kone","prenom":"Awa Marie","matricule":"MAT-6001",
                                 "sexe":"FEMININ","dateNaissance":"1998-03-02",
                                 "role":"VENDEUR"}"""))
                .andExpect(status().isOk());

        // Corriger un prenom ne doit pas deconnecter la personne en pleine vente.
        mockMvc.perform(get("/api/auth/moi").header("Authorization", "Bearer " + jetonVendeuse))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.prenom").value("Awa Marie"));
    }

    @Test
    void la_deconnexion_globale_invalide_le_jeton_courant() throws Exception {
        mockMvc.perform(post("/api/auth/deconnexion")
                        .header("Authorization", "Bearer " + jetonVendeuse))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/auth/moi").header("Authorization", "Bearer " + jetonVendeuse))
                .andExpect(status().isUnauthorized());

        // Le compte reste utilisable : on s'est deconnecte, pas desactive.
        mockMvc.perform(get("/api/auth/moi")
                        .header("Authorization", "Bearer " + jeton("awa.revoc", "motdepasse1")))
                .andExpect(status().isOk());
    }

    @Test
    void le_gerant_peut_deconnecter_un_utilisateur_de_tous_ses_appareils() throws Exception {
        mockMvc.perform(post("/api/utilisateurs/" + idVendeuse + "/deconnexion")
                        .header("Authorization", "Bearer " + jetonGerant))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actif").value(true));

        mockMvc.perform(get("/api/auth/moi").header("Authorization", "Bearer " + jetonVendeuse))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/auth/moi")
                        .header("Authorization", "Bearer " + jeton("awa.revoc", "motdepasse1")))
                .andExpect(status().isOk());
    }

    @Test
    void un_vendeur_ne_peut_pas_deconnecter_les_autres() throws Exception {
        mockMvc.perform(post("/api/utilisateurs/" + idVendeuse + "/deconnexion")
                        .header("Authorization", "Bearer " + jetonVendeuse))
                .andExpect(status().isForbidden());
    }

    @Test
    void la_deconnexion_globale_est_rejouable_sans_effet_de_bord() throws Exception {
        String premier = jeton("awa.revoc", "motdepasse1");
        mockMvc.perform(post("/api/auth/deconnexion")
                        .header("Authorization", "Bearer " + premier))
                .andExpect(status().isNoContent());

        String second = jeton("awa.revoc", "motdepasse1");
        mockMvc.perform(post("/api/auth/deconnexion")
                        .header("Authorization", "Bearer " + second))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/auth/moi").header("Authorization", "Bearer " + second))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/auth/moi")
                        .header("Authorization", "Bearer " + jeton("awa.revoc", "motdepasse1")))
                .andExpect(status().isOk());
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
