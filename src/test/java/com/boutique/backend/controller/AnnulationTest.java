package com.boutique.backend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.boutique.backend.model.Produit;
import com.boutique.backend.model.Role;
import com.boutique.backend.model.Sexe;
import com.boutique.backend.model.UniteMesure;
import com.boutique.backend.model.Utilisateur;
import com.boutique.backend.repository.AchatRepository;
import com.boutique.backend.repository.MouvementStockRepository;
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
 * Sans {@code @Transactional} : les écritures doivent committer pour que les
 * agrégations et le stock relu reflètent la réalité.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AnnulationTest {

    private static final String VENDEUR = "vendeur.annulation";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    ProduitRepository produitRepository;

    @Autowired
    MouvementStockRepository mouvementStockRepository;

    @Autowired
    AchatRepository achatRepository;

    @Autowired
    UtilisateurRepository utilisateurRepository;

    @Autowired
    UtilisateurService utilisateurService;

    private String jeton;
    private Long produitId;

    @BeforeEach
    void preparer() throws Exception {
        jeton = jetonDe("gerant", "gerant123");
        produitId = produitRepository.save(Produit.builder()
                .nom("Produit annulation")
                .prixAchat(new BigDecimal("1000.00"))
                .prixVente(new BigDecimal("1500.00"))
                .unite(UniteMesure.PIECE)
                .quantiteStock(20)
                .seuilAlerte(2)
                .build()).getId();
    }

    @AfterEach
    void nettoyer() {
        achatRepository.deleteAll();
        // Avant les produits : le journal des mouvements les reference.
        mouvementStockRepository.deleteAll();
        produitRepository.deleteAll();
        utilisateurRepository.findByIdentifiant(VENDEUR)
                .ifPresent(utilisateurRepository::delete);
    }

    @Test
    void une_vente_annulee_change_de_statut_et_garde_sa_trace() throws Exception {
        long achatId = vendre(3);

        mockMvc.perform(annuler(achatId, "ERREUR_SAISIE", true, "double encaissement"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statut").value("ANNULE"))
                .andExpect(jsonPath("$.motifAnnulation").value("ERREUR_SAISIE"))
                .andExpect(jsonPath("$.commentaireAnnulation").value("double encaissement"))
                .andExpect(jsonPath("$.dateAnnulation").exists())
                // L'annulation reste attribuable.
                .andExpect(jsonPath("$.annulePar").value("Gerant Ouattara"));
    }

    @Test
    void le_stock_revient_quand_la_marchandise_retourne_en_rayon() throws Exception {
        long achatId = vendre(3);
        assertThat(stock()).isEqualTo(17);

        mockMvc.perform(annuler(achatId, "ERREUR_SAISIE", true, null))
                .andExpect(status().isOk());

        assertThat(stock()).as("les articles n'ont jamais quitté la boutique").isEqualTo(20);
    }

    /**
     * Une marchandise abîmée ne doit pas réapparaître comme vendable : le stock
     * resterait juste en nombre et faux en réalité.
     */
    @Test
    void le_stock_ne_revient_pas_pour_un_produit_defectueux() throws Exception {
        long achatId = vendre(3);
        assertThat(stock()).isEqualTo(17);

        mockMvc.perform(annuler(achatId, "PRODUIT_DEFECTUEUX", false, "paquet éventré"))
                .andExpect(status().isOk());

        assertThat(stock()).as("la marchandise est perdue, pas revenue en rayon").isEqualTo(17);
    }

    @Test
    void une_vente_deja_annulee_ne_se_rannule_pas() throws Exception {
        long achatId = vendre(1);
        mockMvc.perform(annuler(achatId, "RETOUR_CLIENT", true, null)).andExpect(status().isOk());

        mockMvc.perform(annuler(achatId, "RETOUR_CLIENT", true, null))
                .andExpect(status().isConflict());

        // Et le stock n'a pas été rendu deux fois.
        assertThat(stock()).isEqualTo(20);
    }

    @Test
    void le_motif_est_obligatoire() throws Exception {
        long achatId = vendre(1);

        mockMvc.perform(patch("/api/achats/" + achatId + "/annulation")
                        .header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"retourEnStock":true}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.champs.motif").exists());
    }

    @Test
    void le_retour_en_stock_doit_etre_tranche_explicitement() throws Exception {
        long achatId = vendre(1);

        mockMvc.perform(patch("/api/achats/" + achatId + "/annulation")
                        .header("Authorization", "Bearer " + jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"motif":"RETOUR_CLIENT"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.champs.retourEnStock").exists());
    }

    @Test
    void une_vente_inexistante_renvoie_404() throws Exception {
        mockMvc.perform(annuler(999_999L, "AUTRE", true, null))
                .andExpect(status().isNotFound());
    }

    /**
     * Laisser un vendeur annuler ses propres encaissements ouvre la porte au
     * détournement : la vente quitte le chiffre d'affaires sans que l'argent
     * revienne en caisse.
     */
    @Test
    void un_vendeur_ne_peut_pas_annuler_une_vente() throws Exception {
        long achatId = vendre(1);
        utilisateurService.creer(Utilisateur.builder()
                .nom("Traore").prenom("Ibrahim").matricule("MAT-ANN-1")
                .sexe(Sexe.MASCULIN).dateNaissance(LocalDate.of(1996, 11, 2))
                .identifiant(VENDEUR).role(Role.VENDEUR).build(), "motdepasse1");
        String jetonVendeur = jetonDe(VENDEUR, "motdepasse1");

        mockMvc.perform(patch("/api/achats/" + achatId + "/annulation")
                        .header("Authorization", "Bearer " + jetonVendeur)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"motif":"ERREUR_SAISIE","retourEnStock":true}"""))
                .andExpect(status().isForbidden());
    }

    @Test
    void la_vente_annulee_quitte_le_chiffre_d_affaires_et_la_marge() throws Exception {
        long conservee = vendre(2);
        long annulee = vendre(4);
        // 6 x 1 500 de chiffre, et 6 x (1 500 - 1 000) de marge
        attendreStatistiques(9000.00, 3000.00);

        mockMvc.perform(annuler(annulee, "RETOUR_CLIENT", true, null)).andExpect(status().isOk());

        // Ne reste que 2 x 1 500, et 2 x (1 500 - 1 000) de marge.
        attendreStatistiques(3000.00, 1000.00);
        assertThat(conservee).isPositive();
    }

    @Test
    void la_vente_annulee_quitte_aussi_la_ventilation_par_moyen() throws Exception {
        long achatId = vendre(2);
        mockMvc.perform(annuler(achatId, "ERREUR_SAISIE", true, null)).andExpect(status().isOk());

        mockMvc.perform(statistiques())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ventesParMode.length()").value(0))
                .andExpect(jsonPath("$.ventesParJour.length()").value(0))
                .andExpect(jsonPath("$.meilleuresVentes.length()").value(0));
    }

    @Test
    void la_vente_annulee_reste_dans_l_historique() throws Exception {
        long achatId = vendre(1);
        mockMvc.perform(annuler(achatId, "AUTRE", true, null)).andExpect(status().isOk());

        // Son ticket a été remis au client : elle ne disparaît pas.
        mockMvc.perform(get("/api/achats/" + achatId)
                        .header("Authorization", "Bearer " + jeton))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statut").value("ANNULE"));
    }

    @Test
    void le_ticket_d_une_vente_annulee_le_dit() throws Exception {
        long achatId = vendre(1);
        mockMvc.perform(annuler(achatId, "RETOUR_CLIENT", true, null)).andExpect(status().isOk());

        byte[] pdf = mockMvc.perform(get("/api/achats/" + achatId + "/ticket")
                        .header("Authorization", "Bearer " + jeton))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        String texte = new org.apache.pdfbox.text.PDFTextStripper()
                .getText(org.apache.pdfbox.Loader.loadPDF(pdf));

        assertThat(texte).contains("VENTE ANNULEE");
        assertThat(texte).doesNotContain("Merci de votre visite");
    }

    /* --- utilitaires --- */

    private void attendreStatistiques(double chiffreAffaires, double marge) throws Exception {
        mockMvc.perform(statistiques())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ventes.chiffreAffaires").value(chiffreAffaires))
                .andExpect(jsonPath("$.ventes.marge").value(marge));
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
            statistiques() {
        return get("/api/statistiques")
                .param("du", LocalDate.now().toString())
                .param("au", LocalDate.now().toString())
                .header("Authorization", "Bearer " + jeton);
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
            annuler(long achatId, String motif, boolean retour, String commentaire) {
        String corps = commentaire == null
                ? """
                  {"motif":"%s","retourEnStock":%s}""".formatted(motif, retour)
                : """
                  {"motif":"%s","retourEnStock":%s,"commentaire":"%s"}"""
                        .formatted(motif, retour, commentaire);
        return patch("/api/achats/" + achatId + "/annulation")
                .header("Authorization", "Bearer " + jeton)
                .contentType(MediaType.APPLICATION_JSON)
                .content(corps);
    }

    private long vendre(int quantite) throws Exception {
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

    private int stock() {
        return produitRepository.findById(produitId).orElseThrow().getQuantiteStock();
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
