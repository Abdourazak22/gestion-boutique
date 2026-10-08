package com.boutique.backend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.boutique.backend.model.Achat;
import com.boutique.backend.model.LigneAchat;
import com.boutique.backend.model.Role;
import com.boutique.backend.model.Sexe;
import com.boutique.backend.model.Utilisateur;
import com.boutique.backend.repository.AchatRepository;
import com.boutique.backend.service.UtilisateurService;
import java.nio.charset.StandardCharsets;
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

/**
 * Export CSV des ventes pour la comptabilité.
 *
 * <p>Le fichier est destiné à un tableur configuré en français : séparateur
 * point-virgule, virgule décimale, et marque d'ordre des octets pour qu'Excel
 * reconnaisse l'UTF-8.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ExportComptableTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    AchatRepository achatRepository;

    @Autowired
    UtilisateurService utilisateurService;

    private String jetonGerant;
    private long rizId;

    @BeforeEach
    void preparer() throws Exception {
        jetonGerant = jeton("gerant", "gerant123");
        rizId = creerProduit("""
                {"nom":"Riz parfume 5kg","prixAchat":4500.00,"prixVente":5500.00,
                 "unite":"SACHET","quantiteStock":50,"seuilAlerte":5}""");
    }

    @Test
    void le_fichier_porte_un_entete_et_une_ligne_par_vente() throws Exception {
        vendre(2, null);
        vendre(3, null);

        String csv = exporter();
        String[] lignes = csv.split("\r\n");

        assertThat(lignes[0]).startsWith("﻿Numéro;Date;Heure;Statut;Mode de paiement");
        assertThat(lignes).hasSize(3);
    }

    /**
     * Sans virgule décimale les montants arrivent en texte dans le tableur, et
     * aucune somme ne fonctionne. Sans la marque d'ordre des octets, Excel lit
     * le fichier en ANSI et « Espèces » devient « EspÃ¨ces ».
     */
    @Test
    void les_montants_utilisent_la_virgule_et_le_fichier_commence_par_un_bom() throws Exception {
        long id = vendre(2, null);

        String csv = exporter();

        assertThat(csv).startsWith("﻿");
        // 2 x 5500 = 11000 vendus, 2 x 4500 = 9000 de coût, soit 2000 de marge.
        assertThat(colonne(csv, numeroDe(id), "Montant encaissé")).isEqualTo("11000,00");
        assertThat(colonne(csv, numeroDe(id), "Marge")).isEqualTo("2000,00");
        assertThat(csv).doesNotContain("11000.00");
    }

    @Test
    void une_vente_annulee_figure_dans_le_fichier_avec_son_motif() throws Exception {
        long id = vendre(2, null);
        mockMvc.perform(patch("/api/achats/" + id + "/annulation")
                        .header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"motif":"RETOUR_CLIENT","retourEnStock":true}"""))
                .andExpect(status().isOk());

        String csv = exporter();

        // Une comptabilité doit voir ce qui a été annulé, pas seulement ce qui reste.
        assertThat(csv).contains("Annulée");
        assertThat(csv).contains("Retour client");
        assertThat(csv).contains("Gerant Ouattara");
    }

    /**
     * Un nom de client contenant le séparateur décalerait toutes les colonnes
     * suivantes s'il n'était pas protégé.
     */
    @Test
    void une_valeur_contenant_le_separateur_est_protegee() throws Exception {
        vendre(1, "Kone; Awa");

        String csv = exporter();

        assertThat(csv).contains("\"Kone; Awa\"");
    }

    /**
     * La colonne du coût d'achat a été ajoutée après les premières ventes :
     * certaines lignes l'ignorent. Mieux vaut une marge vide qu'une marge
     * surévaluée que personne ne saurait reconnaître comme fausse.
     */
    @Test
    void la_marge_reste_vide_quand_un_cout_d_achat_manque() throws Exception {
        vendre(2, null);
        Achat achat = achatRepository.findAll().get(0);
        for (LigneAchat ligne : achat.getLignes()) {
            ligne.setPrixAchatUnitaire(null);
        }
        achatRepository.saveAndFlush(achat);

        String csv = exporter();

        assertThat(colonne(csv, achat.getNumero(), "Montant encaissé")).isEqualTo("11000,00");
        assertThat(colonne(csv, achat.getNumero(), "Marge")).isEmpty();
    }

    /**
     * Le point de toute la séparation : additionner « Montant encaissé » donne
     * le chiffre d'affaires sans avoir à filtrer le statut. Avec une colonne
     * unique, une somme naïve gonflait la recette du montant des annulations.
     */
    @Test
    void une_vente_annulee_ne_compte_ni_en_recette_ni_en_marge() throws Exception {
        long id = vendre(2, null);
        String numero = numeroDe(id);
        mockMvc.perform(patch("/api/achats/" + id + "/annulation")
                        .header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"motif":"ERREUR_SAISIE","retourEnStock":true}"""))
                .andExpect(status().isOk());

        String csv = exporter();

        assertThat(colonne(csv, numero, "Montant encaissé")).isEmpty();
        assertThat(colonne(csv, numero, "Montant annulé")).isEqualTo("11000,00");
        assertThat(colonne(csv, numero, "Marge")).isEmpty();
    }

    @Test
    void le_fichier_est_servi_en_telechargement() throws Exception {
        vendre(1, null);

        mockMvc.perform(get("/api/achats/export")
                        .header("Authorization", "Bearer " + jetonGerant))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition",
                        org.hamcrest.Matchers.containsString("attachment")))
                .andExpect(header().string("Content-Disposition",
                        org.hamcrest.Matchers.containsString(".csv")));
    }

    /**
     * {@code /export} doit se résoudre vers l'export et non vers
     * {@code /{id}}, qui tenterait de lire « export » comme un identifiant.
     */
    @Test
    void la_route_export_ne_se_confond_pas_avec_un_identifiant() throws Exception {
        mockMvc.perform(get("/api/achats/export")
                        .header("Authorization", "Bearer " + jetonGerant))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type",
                        org.hamcrest.Matchers.containsString("text/csv")));
    }

    /** Le fichier porte les marges, que les statistiques réservent au gérant. */
    @Test
    void un_vendeur_ne_peut_pas_exporter() throws Exception {
        utilisateurService.creer(Utilisateur.builder()
                .nom("Soma").prenom("Issa").matricule("MAT-6001")
                .sexe(Sexe.MASCULIN).dateNaissance(LocalDate.of(1996, 5, 10))
                .identifiant("issa.export").role(Role.VENDEUR).build(), "motdepasse1");

        mockMvc.perform(get("/api/achats/export")
                        .header("Authorization", "Bearer " + jeton("issa.export", "motdepasse1")))
                .andExpect(status().isForbidden());
    }

    @Test
    void une_periode_a_l_envers_est_refusee() throws Exception {
        mockMvc.perform(get("/api/achats/export")
                        .param("du", "2026-10-08").param("au", "2026-10-01")
                        .header("Authorization", "Bearer " + jetonGerant))
                .andExpect(status().isConflict());
    }

    /**
     * Lit le fichier et rend la valeur d'une colonne nommée, pour la ligne
     * dont le numéro de vente est donné. Les assertions portent ainsi sur des
     * colonnes et non sur des positions, qu'un déplacement casserait.
     */
    private String colonne(String csv, String numeroVente, String nomColonne) {
        String[] lignes = csv.split("\r\n");
        String[] entetes = lignes[0].replace("\uFEFF", "").split(";", -1);
        int index = java.util.Arrays.asList(entetes).indexOf(nomColonne);
        assertThat(index).as("colonne « %s »", nomColonne).isNotNegative();

        for (int i = 1; i < lignes.length; i++) {
            String[] cases = lignes[i].split(";", -1);
            if (cases[0].equals(numeroVente)) {
                return cases[index];
            }
        }
        throw new AssertionError("vente " + numeroVente + " absente du fichier");
    }

    private String numeroDe(long achatId) {
        return achatRepository.findById(achatId).orElseThrow().getNumero();
    }

    private String exporter() throws Exception {
        byte[] contenu = mockMvc.perform(get("/api/achats/export")
                        .header("Authorization", "Bearer " + jetonGerant))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        return new String(contenu, StandardCharsets.UTF_8);
    }

    private long vendre(int quantite, String client) throws Exception {
        String nomClient = client == null ? "" : ",\"nomClient\":\"%s\"".formatted(client);
        String reponse = mockMvc.perform(post("/api/achats")
                        .header("Authorization", "Bearer " + jetonGerant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"modePaiement":"ESPECES"%s,
                                 "lignes":[{"produitId":%d,"quantite":%d}]}"""
                                .formatted(nomClient, rizId, quantite)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(reponse).get("id").asLong();
    }

    private long creerProduit(String corps) throws Exception {
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
