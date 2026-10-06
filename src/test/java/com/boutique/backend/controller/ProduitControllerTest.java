package com.boutique.backend.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
    void modification_change_le_prix_sans_toucher_au_stock() throws Exception {
        long id = creerRiz();

        mockMvc.perform(put("/api/produits/" + id)
                        .header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nom":"Riz parfume 5kg","prixAchat":4500.00,"prixVente":6000.00,
                                 "unite":"SACHET","seuilAlerte":5}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.prixVente").value(6000.00))
                .andExpect(jsonPath("$.quantiteStock").value(30));
    }

    /**
     * Ce corps etait accepte, et c'etait le defaut : il ecrivait le stock en
     * valeur absolue, telle qu'elle avait ete lue a l'ouverture du formulaire.
     * Une vente saisie entre-temps par un autre utilisateur disparaissait donc
     * du stock, sans trace.
     */
    @Test
    void modification_qui_tente_d_ecrire_le_stock_est_refusee() throws Exception {
        long id = creerRiz();

        mockMvc.perform(put("/api/produits/" + id)
                        .header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nom":"Riz parfume 5kg","prixAchat":4500.00,"prixVente":6000.00,
                                 "unite":"SACHET","quantiteStock":2,"seuilAlerte":5}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.champs.quantiteStock").exists());

        mockMvc.perform(get("/api/produits/" + id)
                        .header("Authorization", "Bearer " + jetonGerant))
                .andExpect(jsonPath("$.quantiteStock").value(30));
    }

    @Test
    void ajustement_aligne_le_stock_sur_le_comptage_et_journalise_l_ecart() throws Exception {
        long id = creerRiz();

        mockMvc.perform(patch("/api/produits/" + id + "/ajustement")
                        .header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"quantiteComptee":28,"motif":"CASSE",
                                 "commentaire":"Deux sachets eventres"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quantiteStock").value(28));

        mockMvc.perform(get("/api/produits/" + id + "/mouvements")
                        .header("Authorization", "Bearer " + jetonGerant))
                .andExpect(status().isOk())
                // Le plus recent d'abord : l'ajustement, puis le stock initial.
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].type").value("AJUSTEMENT"))
                .andExpect(jsonPath("$.content[0].variation").value(-2))
                .andExpect(jsonPath("$.content[0].stockAvant").value(30))
                .andExpect(jsonPath("$.content[0].stockApres").value(28))
                .andExpect(jsonPath("$.content[0].motif").value("CASSE"))
                .andExpect(jsonPath("$.content[0].commentaire").value("Deux sachets eventres"))
                .andExpect(jsonPath("$.content[0].auteur").isString())
                .andExpect(jsonPath("$.content[1].type").value("INITIAL"))
                .andExpect(jsonPath("$.content[1].variation").value(30));
    }

    @Test
    void ecart_de_stock_sans_motif_est_refuse() throws Exception {
        long id = creerRiz();

        mockMvc.perform(patch("/api/produits/" + id + "/ajustement")
                        .header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"quantiteComptee":28}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.champs.motif").exists());
    }

    /**
     * Un comptage qui confirme le stock n'a aucun motif a fournir, et merite
     * tout de meme sa ligne : savoir qu'un produit a ete verifie tel jour est
     * une information.
     */
    @Test
    void comptage_conforme_est_enregistre_sans_motif() throws Exception {
        long id = creerRiz();

        mockMvc.perform(patch("/api/produits/" + id + "/ajustement")
                        .header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"quantiteComptee":30}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quantiteStock").value(30));

        mockMvc.perform(get("/api/produits/" + id + "/mouvements")
                        .header("Authorization", "Bearer " + jetonGerant))
                .andExpect(jsonPath("$.content[0].type").value("AJUSTEMENT"))
                .andExpect(jsonPath("$.content[0].variation").value(0))
                .andExpect(jsonPath("$.content[0].motif").doesNotExist());
    }

    /**
     * L'ajustement est le mecanisme qui permettrait de faire disparaitre un
     * manquant : celui qui tient la caisse ne doit pas pouvoir effacer l'ecart
     * qu'elle laisse, ni consulter le registre ou il se lit.
     */
    @Test
    void un_vendeur_ne_peut_ni_ajuster_le_stock_ni_lire_le_journal() throws Exception {
        long id = creerRiz();
        utilisateurService.creer(Utilisateur.builder()
                .nom("Sawadogo").prenom("Issa").matricule("MAT-9002")
                .sexe(Sexe.MASCULIN).dateNaissance(LocalDate.of(1995, 7, 14))
                .identifiant("vendeur-stock").role(Role.VENDEUR).build(), "vendeur123");
        String jetonVendeur = jeton("vendeur-stock", "vendeur123");

        mockMvc.perform(patch("/api/produits/" + id + "/ajustement")
                        .header("Authorization", "Bearer " + jetonVendeur)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"quantiteComptee":0,"motif":"VOL"}"""))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/produits/" + id + "/mouvements")
                        .header("Authorization", "Bearer " + jetonVendeur))
                .andExpect(status().isForbidden());
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
