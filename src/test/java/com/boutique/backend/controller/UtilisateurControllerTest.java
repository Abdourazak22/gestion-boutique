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

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class UtilisateurControllerTest {

    private static final String VENDEUSE = """
            {"nom":"Kone","prenom":"Awa","matricule":"MAT-5001","sexe":"FEMININ",
             "dateNaissance":"1998-03-02","identifiant":"awa.kone",
             "motDePasse":"motdepasse1","role":"VENDEUR"}""";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    private String jetonGerant;

    @BeforeEach
    void connecter() throws Exception {
        jetonGerant = jeton("gerant", "gerant123");
    }

    @Test
    void le_gerant_ajoute_un_utilisateur_et_recoit_201() throws Exception {
        mockMvc.perform(post("/api/utilisateurs").header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON).content(VENDEUSE))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.identifiant").value("awa.kone"))
                .andExpect(jsonPath("$.role").value("VENDEUR"))
                .andExpect(jsonPath("$.actif").value(true))
                // le hash ne doit jamais sortir de l'API
                .andExpect(jsonPath("$.motDePasse").doesNotExist());
    }

    @Test
    void l_utilisateur_cree_peut_se_connecter() throws Exception {
        creerVendeuse();
        mockMvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"identifiant":"awa.kone","motDePasse":"motdepasse1"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.utilisateur.prenom").value("Awa"));
    }

    @Test
    void identifiant_deja_pris_retourne_409() throws Exception {
        creerVendeuse();
        mockMvc.perform(post("/api/utilisateurs").header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON).content(VENDEUSE))
                .andExpect(status().isConflict());
    }

    @Test
    void mot_de_passe_trop_court_retourne_400() throws Exception {
        mockMvc.perform(post("/api/utilisateurs").header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VENDEUSE.replace("\"motdepasse1\"", "\"court\"")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.champs.motDePasse").isNotEmpty());
    }

    @Test
    void identifiant_avec_espaces_retourne_400() throws Exception {
        mockMvc.perform(post("/api/utilisateurs").header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VENDEUSE.replace("\"awa.kone\"", "\"awa kone\"")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.champs.identifiant").isNotEmpty());
    }

    @Test
    void date_de_naissance_future_retourne_400() throws Exception {
        mockMvc.perform(post("/api/utilisateurs").header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VENDEUSE.replace("\"1998-03-02\"", "\"2099-01-01\"")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.champs.dateNaissance").isNotEmpty());
    }

    @Test
    void un_vendeur_ne_peut_pas_administrer_les_utilisateurs() throws Exception {
        creerVendeuse();
        String jetonVendeuse = jeton("awa.kone", "motdepasse1");

        mockMvc.perform(get("/api/utilisateurs").header("Authorization", "Bearer " + jetonVendeuse))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/utilisateurs").header("Authorization", "Bearer " + jetonVendeuse)
                        .contentType(MediaType.APPLICATION_JSON).content(VENDEUSE))
                .andExpect(status().isForbidden());
    }

    @Test
    void modification_met_a_jour_l_etat_civil() throws Exception {
        long id = creerVendeuse();
        mockMvc.perform(put("/api/utilisateurs/" + id)
                        .header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nom":"Kone","prenom":"Awa Marie","matricule":"MAT-5002",
                                 "sexe":"FEMININ","dateNaissance":"1998-03-02","role":"VENDEUR"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.prenom").value("Awa Marie"))
                .andExpect(jsonPath("$.matricule").value("MAT-5002"));
    }

    @Test
    void desactivation_empeche_la_connexion() throws Exception {
        long id = creerVendeuse();

        mockMvc.perform(patch("/api/utilisateurs/" + id + "/statut")
                        .header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"actif":false}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actif").value(false));

        mockMvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"identifiant":"awa.kone","motDePasse":"motdepasse1"}"""))
                .andExpect(status().isForbidden());
    }

    @Test
    void desactiver_le_dernier_gerant_est_refuse() throws Exception {
        long idGerant = objectMapper.readTree(mockMvc.perform(get("/api/auth/moi")
                        .header("Authorization", "Bearer " + jetonGerant))
                .andReturn().getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(patch("/api/utilisateurs/" + idGerant + "/statut")
                        .header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"actif":false}"""))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message")
                        .value(org.hamcrest.Matchers.containsString("dernier gérant")));
    }

    @Test
    void liste_paginee_des_utilisateurs() throws Exception {
        creerVendeuse();
        mockMvc.perform(get("/api/utilisateurs").header("Authorization", "Bearer " + jetonGerant))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.page.totalElements").value(2));
    }

    @Test
    void utilisateur_inexistant_retourne_404() throws Exception {
        mockMvc.perform(get("/api/utilisateurs/999999")
                        .header("Authorization", "Bearer " + jetonGerant))
                .andExpect(status().isNotFound());
    }

    @Test
    void changement_de_mot_de_passe_puis_connexion_avec_le_nouveau() throws Exception {
        creerVendeuse();
        String jetonVendeuse = jeton("awa.kone", "motdepasse1");

        mockMvc.perform(patch("/api/auth/mot-de-passe")
                        .header("Authorization", "Bearer " + jetonVendeuse)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"motDePasseActuel":"motdepasse1",
                                 "nouveauMotDePasse":"nouveaupass1"}"""))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"identifiant":"awa.kone","motDePasse":"nouveaupass1"}"""))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"identifiant":"awa.kone","motDePasse":"motdepasse1"}"""))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void mauvais_mot_de_passe_actuel_retourne_401() throws Exception {
        creerVendeuse();
        String jetonVendeuse = jeton("awa.kone", "motdepasse1");

        mockMvc.perform(patch("/api/auth/mot-de-passe")
                        .header("Authorization", "Bearer " + jetonVendeuse)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"motDePasseActuel":"faux","nouveauMotDePasse":"nouveaupass1"}"""))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void reutiliser_le_meme_mot_de_passe_retourne_409() throws Exception {
        creerVendeuse();
        String jetonVendeuse = jeton("awa.kone", "motdepasse1");

        mockMvc.perform(patch("/api/auth/mot-de-passe")
                        .header("Authorization", "Bearer " + jetonVendeuse)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"motDePasseActuel":"motdepasse1",
                                 "nouveauMotDePasse":"motdepasse1"}"""))
                .andExpect(status().isConflict());
    }

    /**
     * Le mot de passe perdu condamnait le compte : seul son propriétaire
     * pouvait le changer, et seulement en connaissant l'ancien. Le parcours est
     * vérifié de bout en bout, l'ancien refusé et le nouveau accepté.
     */
    @Test
    void le_gerant_reinitialise_un_mot_de_passe_perdu() throws Exception {
        long id = creerVendeuse();

        mockMvc.perform(patch("/api/utilisateurs/" + id + "/mot-de-passe")
                        .header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nouveauMotDePasse":"nouveaumotdepasse"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.identifiant").value("awa.kone"))
                .andExpect(jsonPath("$.motDePasse").doesNotExist());

        // L'ancien ne vaut plus rien.
        mockMvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"identifiant":"awa.kone","motDePasse":"motdepasse1"}"""))
                .andExpect(status().isUnauthorized());

        // Le nouveau ouvre bien le compte.
        mockMvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"identifiant":"awa.kone","motDePasse":"nouveaumotdepasse"}"""))
                .andExpect(status().isOk());
    }

    /**
     * Une réinitialisation suit souvent un appareil perdu. Laisser les sessions
     * ouvertes la viderait de son sens.
     */
    @Test
    void la_reinitialisation_revoque_les_jetons_du_compte() throws Exception {
        long id = creerVendeuse();
        String jetonVendeuse = jeton("awa.kone", "motdepasse1");

        mockMvc.perform(get("/api/auth/moi").header("Authorization", "Bearer " + jetonVendeuse))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/utilisateurs/" + id + "/mot-de-passe")
                        .header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nouveauMotDePasse":"nouveaumotdepasse"}"""))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/auth/moi").header("Authorization", "Bearer " + jetonVendeuse))
                .andExpect(status().isUnauthorized());
    }

    /**
     * Refusé sur son propre compte : une session de gérant détournée pourrait
     * sinon changer le mot de passe sans connaître l'ancien, et verrouiller le
     * vrai gérant dehors.
     */
    @Test
    void le_gerant_ne_peut_pas_reinitialiser_le_sien() throws Exception {
        String reponse = mockMvc.perform(get("/api/auth/moi")
                        .header("Authorization", "Bearer " + jetonGerant))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        long idGerant = objectMapper.readTree(reponse).get("id").asLong();

        mockMvc.perform(patch("/api/utilisateurs/" + idGerant + "/mot-de-passe")
                        .header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nouveauMotDePasse":"nouveaumotdepasse"}"""))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(
                        org.hamcrest.Matchers.containsString("vos paramètres")));

        // Et son mot de passe n'a pas changé.
        mockMvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"identifiant":"gerant","motDePasse":"gerant123"}"""))
                .andExpect(status().isOk());
    }

    @Test
    void un_vendeur_ne_peut_pas_reinitialiser_un_mot_de_passe() throws Exception {
        long id = creerVendeuse();
        String jetonVendeuse = jeton("awa.kone", "motdepasse1");

        mockMvc.perform(patch("/api/utilisateurs/" + id + "/mot-de-passe")
                        .header("Authorization", "Bearer " + jetonVendeuse)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nouveauMotDePasse":"nouveaumotdepasse"}"""))
                .andExpect(status().isForbidden());
    }

    @Test
    void un_mot_de_passe_trop_court_est_refuse() throws Exception {
        long id = creerVendeuse();

        mockMvc.perform(patch("/api/utilisateurs/" + id + "/mot-de-passe")
                        .header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nouveauMotDePasse":"court"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.champs.nouveauMotDePasse").exists());
    }

    private long creerVendeuse() throws Exception {
        String reponse = mockMvc.perform(post("/api/utilisateurs")
                        .header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON).content(VENDEUSE))
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
