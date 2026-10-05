package com.boutique.backend.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.boutique.backend.model.Produit;
import com.boutique.backend.model.Role;
import com.boutique.backend.model.Sexe;
import com.boutique.backend.model.UniteMesure;
import com.boutique.backend.model.Utilisateur;
import com.boutique.backend.repository.AchatRepository;
import com.boutique.backend.repository.LivraisonRepository;
import com.boutique.backend.repository.ProduitRepository;
import com.boutique.backend.repository.UtilisateurRepository;
import com.boutique.backend.service.UtilisateurService;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

/**
 * Sans {@code @Transactional} : les ventes doivent être committées pour que les
 * requêtes d'agrégation les voient. Nettoyage explicite.
 *
 * Le jeu d'essai est choisi pour que chaque total soit vérifiable de tête :
 * 3 sacs de riz à 1 500 (achetés 1 000) et 2 paquets de sucre à 500 (achetés
 * 200), soit un chiffre d'affaires de 5 500 et une marge de 2 100.
 */
@SpringBootTest
@AutoConfigureMockMvc
class StatistiquesControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    ProduitRepository produitRepository;

    @Autowired
    AchatRepository achatRepository;

    @Autowired
    LivraisonRepository livraisonRepository;

    @Autowired
    UtilisateurService utilisateurService;

    @Autowired
    UtilisateurRepository utilisateurRepository;

    private static final String IDENTIFIANT_VENDEUR = "vendeur.stat";

    private String jeton;
    private Long rizId;
    private Long sucreId;

    @BeforeEach
    void preparer() throws Exception {
        jeton = jetonGerant();
        rizId = enregistrer("Riz statistiques", "1000.00", "1500.00", 20, 5);
        sucreId = enregistrer("Sucre statistiques", "200.00", "500.00", 3, 5);

        vendre("""
                {"modePaiement":"ESPECES","lignes":[{"produitId":%d,"quantite":3},{"produitId":%d,"quantite":2}]}"""
                .formatted(rizId, sucreId));
    }

    @AfterEach
    void nettoyer() {
        achatRepository.deleteAll();
        livraisonRepository.deleteAll();
        produitRepository.deleteAll();
        // Sans @Transactional, le vendeur créé par un test survivrait à la
        // classe et fausserait le comptage des autres suites.
        utilisateurRepository.findByIdentifiant(IDENTIFIANT_VENDEUR)
                .ifPresent(utilisateurRepository::delete);
    }

    @Test
    void les_totaux_des_ventes_sont_agreges_sur_la_periode() throws Exception {
        mockMvc.perform(statistiques(LocalDate.now(), LocalDate.now()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ventes.nombre").value(1))
                .andExpect(jsonPath("$.ventes.chiffreAffaires").value(5500.00))
                // 3 x (1500 - 1000) + 2 x (500 - 200)
                .andExpect(jsonPath("$.ventes.marge").value(2100.00));
    }

    @Test
    void la_marge_reste_celle_du_jour_de_la_vente_apres_renegociation_du_prix_d_achat()
            throws Exception {
        Produit riz = produitRepository.findById(rizId).orElseThrow();
        riz.setPrixAchat(new BigDecimal("1400.00"));
        produitRepository.saveAndFlush(riz);

        mockMvc.perform(statistiques(LocalDate.now(), LocalDate.now()))
                .andExpect(status().isOk())
                // Inchangée : le coût de revient est figé dans la ligne de vente.
                .andExpect(jsonPath("$.ventes.marge").value(2100.00));
    }

    @Test
    void le_stock_est_valorise_et_les_alertes_comptees() throws Exception {
        mockMvc.perform(statistiques(LocalDate.now(), LocalDate.now()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stock.references").value(2))
                // Riz 17 x 1000 + Sucre 1 x 200 apres la vente
                .andExpect(jsonPath("$.stock.valeurAchat").value(17200.00))
                .andExpect(jsonPath("$.stock.valeurVente").value(26000.00))
                // Seul le sucre (1 en stock, seuil 5) est sous son seuil
                .andExpect(jsonPath("$.stock.enAlerte").value(1));
    }

    @Test
    void le_classement_des_meilleures_ventes_est_trie_par_chiffre_d_affaires()
            throws Exception {
        mockMvc.perform(statistiques(LocalDate.now(), LocalDate.now()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.meilleuresVentes.length()").value(2))
                .andExpect(jsonPath("$.meilleuresVentes[0].nom").value("Riz statistiques"))
                .andExpect(jsonPath("$.meilleuresVentes[0].quantite").value(3))
                .andExpect(jsonPath("$.meilleuresVentes[0].chiffreAffaires").value(4500.00))
                .andExpect(jsonPath("$.meilleuresVentes[1].nom").value("Sucre statistiques"));
    }

    @Test
    void seules_les_journees_ayant_vendu_sont_renvoyees() throws Exception {
        mockMvc.perform(statistiques(LocalDate.now(), LocalDate.now()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ventesParJour.length()").value(1))
                .andExpect(jsonPath("$.ventesParJour[0].jour").value(LocalDate.now().toString()))
                .andExpect(jsonPath("$.ventesParJour[0].montant").value(5500.00));
    }

    @Test
    void une_periode_sans_vente_renvoie_des_zeros_et_non_des_nuls() throws Exception {
        mockMvc.perform(statistiques(LocalDate.of(2000, 1, 1), LocalDate.of(2000, 1, 31)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ventes.nombre").value(0))
                .andExpect(jsonPath("$.ventes.chiffreAffaires").value(0))
                .andExpect(jsonPath("$.ventes.marge").value(0))
                .andExpect(jsonPath("$.livraisons.montantTotal").value(0))
                .andExpect(jsonPath("$.ventesParJour.length()").value(0))
                .andExpect(jsonPath("$.meilleuresVentes.length()").value(0));
    }

    @Test
    void sans_bornes_la_periode_couvre_le_mois_en_cours() throws Exception {
        mockMvc.perform(get("/api/statistiques").header("Authorization", "Bearer " + jeton))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.du").value(LocalDate.now().withDayOfMonth(1).toString()))
                .andExpect(jsonPath("$.au").value(LocalDate.now().toString()));
    }

    @Test
    void une_plage_inversee_est_refusee() throws Exception {
        mockMvc.perform(statistiques(LocalDate.now().plusDays(10), LocalDate.now()))
                .andExpect(status().isConflict());
    }

    @Test
    void une_date_malformee_est_une_erreur_du_client_pas_du_serveur() throws Exception {
        mockMvc.perform(get("/api/statistiques").param("du", "03/10/2026")
                        .header("Authorization", "Bearer " + jeton))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.champs.du").exists());
    }

    @Test
    void un_vendeur_ne_lit_pas_les_chiffres_de_pilotage() throws Exception {
        utilisateurService.creer(Utilisateur.builder()
                .nom("Traore")
                .prenom("Ibrahim")
                .matricule("MAT-STAT-1")
                .sexe(Sexe.MASCULIN)
                .dateNaissance(LocalDate.of(1996, 11, 2))
                .identifiant(IDENTIFIANT_VENDEUR)
                .role(Role.VENDEUR)
                .build(), "motdepasse1");

        String jetonVendeur = jetonDe(IDENTIFIANT_VENDEUR, "motdepasse1");

        mockMvc.perform(get("/api/statistiques")
                        .header("Authorization", "Bearer " + jetonVendeur))
                .andExpect(status().isForbidden());
    }

    @Test
    void sans_jeton_l_acces_est_refuse() throws Exception {
        mockMvc.perform(get("/api/statistiques")).andExpect(status().isUnauthorized());
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
            statistiques(LocalDate du, LocalDate au) {
        return get("/api/statistiques")
                .param("du", du.toString())
                .param("au", au.toString())
                .header("Authorization", "Bearer " + jeton);
    }

    private void vendre(String corps) throws Exception {
        mockMvc.perform(post("/api/achats").header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corps))
                .andExpect(status().isCreated());
    }

    private Long enregistrer(String nom, String prixAchat, String prixVente,
                             int stock, int seuil) {
        return produitRepository.save(Produit.builder()
                .nom(nom)
                .prixAchat(new BigDecimal(prixAchat))
                .prixVente(new BigDecimal(prixVente))
                .unite(UniteMesure.PIECE)
                .quantiteStock(stock)
                .seuilAlerte(seuil)
                .build()).getId();
    }

    private String jetonGerant() throws Exception {
        return jetonDe("gerant", "gerant123");
    }

    private String jetonDe(String identifiant, String motDePasse) throws Exception {
        String reponse = mockMvc.perform(post("/api/auth/connexion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"identifiant":"%s","motDePasse":"%s"}"""
                                .formatted(identifiant, motDePasse)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(reponse).get("jeton").asText();
    }
}
