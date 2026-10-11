package com.boutique.backend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.boutique.backend.repository.MouvementStockRepository;
import com.boutique.backend.repository.ProduitRepository;
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

/**
 * Le journal des mouvements de stock.
 *
 * <p>Vérifie la règle qui tient tout le reste : chaque variation du stock
 * laisse une ligne, et la somme des variations d'un produit est toujours égale
 * à son stock. Cet invariant est le seul moyen de détecter qu'un chemin a
 * modifié le stock sans passer par le journal.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class JournalStockTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    MouvementStockRepository mouvementStockRepository;

    @Autowired
    ProduitRepository produitRepository;

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
    void la_creation_inscrit_le_stock_initial() throws Exception {
        mockMvc.perform(get("/api/produits/" + rizId + "/mouvements")
                        .header("Authorization", "Bearer " + jeton))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].type").value("INITIAL"))
                .andExpect(jsonPath("$.content[0].variation").value(20))
                .andExpect(jsonPath("$.content[0].stockAvant").value(0))
                .andExpect(jsonPath("$.content[0].stockApres").value(20))
                .andExpect(jsonPath("$.content[0].auteur").value("Gerant Ouattara"));
    }

    @Test
    void une_vente_inscrit_une_sortie_rattachee_a_son_numero() throws Exception {
        vendre(3);

        mockMvc.perform(get("/api/produits/" + rizId + "/mouvements")
                        .header("Authorization", "Bearer " + jeton))
                .andExpect(jsonPath("$.content[0].type").value("SORTIE"))
                .andExpect(jsonPath("$.content[0].variation").value(-3))
                .andExpect(jsonPath("$.content[0].stockAvant").value(20))
                .andExpect(jsonPath("$.content[0].stockApres").value(17))
                // La reference permet de remonter du journal au ticket de caisse.
                .andExpect(jsonPath("$.content[0].reference").value(Matchers.startsWith("ACH-")))
                .andExpect(jsonPath("$.content[0].auteur").value("Gerant Ouattara"));
    }

    @Test
    void une_livraison_inscrit_une_entree_rattachee_a_son_numero() throws Exception {
        mockMvc.perform(post("/api/livraisons").header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nomGrossiste":"Ets Traore","referenceBon":"BL-4421",
                                 "lignes":[{"produitId":%d,"quantite":50,"prixUnitaire":4300.00}]}"""
                                .formatted(rizId)))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/produits/" + rizId + "/mouvements")
                        .header("Authorization", "Bearer " + jeton))
                .andExpect(jsonPath("$.content[0].type").value("ENTREE"))
                .andExpect(jsonPath("$.content[0].variation").value(50))
                .andExpect(jsonPath("$.content[0].stockApres").value(70))
                .andExpect(jsonPath("$.content[0].reference").value(Matchers.startsWith("LIV-")));
    }

    @Test
    void une_annulation_avec_retour_inscrit_un_retour() throws Exception {
        long achatId = vendre(3);

        mockMvc.perform(patch("/api/achats/" + achatId + "/annulation")
                        .header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"motif":"RETOUR_CLIENT","retourEnStock":true}"""))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/produits/" + rizId + "/mouvements")
                        .header("Authorization", "Bearer " + jeton))
                // Trois lignes, de la plus recente a la plus ancienne.
                .andExpect(jsonPath("$.content.length()").value(3))
                .andExpect(jsonPath("$.content[0].type").value("RETOUR"))
                .andExpect(jsonPath("$.content[0].variation").value(3))
                .andExpect(jsonPath("$.content[0].stockApres").value(20))
                .andExpect(jsonPath("$.content[1].type").value("SORTIE"))
                .andExpect(jsonPath("$.content[2].type").value("INITIAL"));
    }

    /**
     * Une annulation sans retour en rayon ne rend rien au stock, et n'a donc
     * aucune raison d'inscrire un mouvement : la marchandise est perdue, pas
     * revenue.
     */
    @Test
    void une_annulation_sans_retour_n_inscrit_aucun_mouvement() throws Exception {
        long achatId = vendre(3);

        mockMvc.perform(patch("/api/achats/" + achatId + "/annulation")
                        .header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"motif":"PRODUIT_DEFECTUEUX","retourEnStock":false}"""))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/produits/" + rizId + "/mouvements")
                        .header("Authorization", "Bearer " + jeton))
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].type").value("SORTIE"));
    }

    /**
     * L'invariant, verifie apres avoir fait passer le produit par les quatre
     * chemins qui touchent au stock.
     */
    @Test
    void la_somme_des_variations_egale_toujours_le_stock() throws Exception {
        long achatId = vendre(4);

        mockMvc.perform(post("/api/livraisons").header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nomGrossiste":"Ets Traore",
                                 "lignes":[{"produitId":%d,"quantite":30}]}""".formatted(rizId)))
                .andExpect(status().isCreated());

        mockMvc.perform(patch("/api/achats/" + achatId + "/annulation")
                        .header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"motif":"ERREUR_SAISIE","retourEnStock":true}"""))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/produits/" + rizId + "/ajustement")
                        .header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"quantiteComptee":45,"motif":"CASSE"}"""))
                .andExpect(status().isOk());

        // 20 initial - 4 vendus + 30 livres + 4 retournes = 50, puis comptes a 45.
        int stock = produitRepository.findById(rizId).orElseThrow().getQuantiteStock();
        assertThat(stock).isEqualTo(45);
        assertThat(mouvementStockRepository.sommeVariations(rizId)).isEqualTo(stock);
    }

    /**
     * Un stock insuffisant refuse la vente : aucun mouvement ne doit rester,
     * sans quoi le journal annoncerait une sortie qui n'a pas eu lieu.
     */
    @Test
    void une_vente_refusee_n_inscrit_aucun_mouvement() throws Exception {
        long avant = mouvementStockRepository.count();

        mockMvc.perform(post("/api/achats").header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"modePaiement":"ESPECES",
                                 "lignes":[{"produitId":%d,"quantite":999}]}""".formatted(rizId)))
                .andExpect(status().isConflict());

        assertThat(mouvementStockRepository.count()).isEqualTo(avant);
        assertThat(mouvementStockRepository.sommeVariations(rizId)).isEqualTo(20);
    }

    private long vendre(int quantite) throws Exception {
        String reponse = mockMvc.perform(post("/api/achats")
                        .header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"modePaiement":"ESPECES",
                                 "lignes":[{"produitId":%d,"quantite":%d}]}"""
                                .formatted(rizId, quantite)))
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
                        .content("{\"identifiant\":\"gerant\",\"motDePasse\":\"gerant123\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(reponse).get("jeton").asText();
    }
}
