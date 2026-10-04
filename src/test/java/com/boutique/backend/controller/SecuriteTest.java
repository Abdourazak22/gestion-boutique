package com.boutique.backend.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.boutique.backend.security.JwtProperties;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import javax.crypto.spec.SecretKeySpec;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

/**
 * Vérifie les garde-fous de sécurité, pas les règles métier : jetons forgés,
 * en-têtes de réponse et blocage du bourrage de mots de passe.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SecuriteTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    JwtEncoder jwtEncoder;

    @Autowired
    JwtProperties jwtProperties;

    @Autowired
    com.boutique.backend.security.TentativesConnexionService tentatives;

    @Test
    void un_jeton_emis_par_une_autre_application_est_refuse() throws Exception {
        // Meme cle, mais claim "iss" different : sans validation de l'emetteur,
        // ce jeton passerait.
        String jeton = forger(jwtEncoder, "une-autre-application", "gerant", List.of("GERANT"));

        mockMvc.perform(get("/api/produits").header("Authorization", "Bearer " + jeton))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("WWW-Authenticate",
                        Matchers.containsString("invalid_token")));
    }

    @Test
    void un_jeton_signe_avec_une_autre_cle_est_refuse() throws Exception {
        JwtEncoder autreEncodeur = new NimbusJwtEncoder(new ImmutableSecret<>(
                new SecretKeySpec("une-cle-pirate-de-32-octets-minimum-aaaa"
                        .getBytes(StandardCharsets.UTF_8), "HmacSHA256")));
        String jeton = forger(autreEncodeur, jwtProperties.emetteur(), "gerant",
                List.of("GERANT"));

        mockMvc.perform(get("/api/produits").header("Authorization", "Bearer " + jeton))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void un_jeton_sans_claim_roles_est_refuse() throws Exception {
        String jeton = forger(jwtEncoder, jwtProperties.emetteur(), "gerant", null);

        mockMvc.perform(get("/api/produits").header("Authorization", "Bearer " + jeton))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void un_jeton_sans_version_est_refuse() throws Exception {
        // Jeton par ailleurs parfaitement valide, mais sans claim "jv" : c'est le
        // cas des jetons emis avant la mise en place de la revocation.
        String jeton = forger(jwtEncoder, jwtProperties.emetteur(), "gerant",
                List.of("GERANT"), null);

        // Spring generalise la description en "Invalid token" : le motif precis
        // reste dans les logs serveur, le client n'apprend rien d'exploitable.
        mockMvc.perform(get("/api/produits").header("Authorization", "Bearer " + jeton))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("WWW-Authenticate",
                        Matchers.containsString("invalid_token")));
    }

    @Test
    void un_jeton_dont_la_version_est_depassee_est_refuse() throws Exception {
        String jeton = forger(jwtEncoder, jwtProperties.emetteur(), "gerant",
                List.of("GERANT"), 9_999L);

        mockMvc.perform(get("/api/produits").header("Authorization", "Bearer " + jeton))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("WWW-Authenticate",
                        Matchers.containsString("invalid_token")));
    }

    @Test
    void un_jeton_dont_le_compte_n_existe_plus_est_refuse() throws Exception {
        String jeton = forger(jwtEncoder, jwtProperties.emetteur(), "compte.supprime.xyz",
                List.of("GERANT"), 0L);

        // Meme reponse que pour un compte existant : pas d'enumeration possible
        // en presentant des jetons forges a la chaine.
        mockMvc.perform(get("/api/produits").header("Authorization", "Bearer " + jeton))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("WWW-Authenticate",
                        Matchers.containsString("invalid_token")));
    }

    @Test
    void un_jeton_expire_est_refuse() throws Exception {
        Instant passe = Instant.now().minus(3, ChronoUnit.HOURS);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(jwtProperties.emetteur())
                .issuedAt(passe)
                .expiresAt(passe.plus(1, ChronoUnit.HOURS))
                .subject("gerant")
                .claim("roles", List.of("GERANT"))
                .build();
        String jeton = jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();

        mockMvc.perform(get("/api/produits").header("Authorization", "Bearer " + jeton))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void un_vendeur_ne_peut_pas_s_octroyer_le_role_gerant_dans_le_jeton() throws Exception {
        // Le role vient du jeton signe : sans la cle, impossible de le falsifier.
        // Avec la cle de test on le prouve dans l'autre sens : un jeton GERANT
        // forge passe, donc la protection repose entierement sur le secret.
        String jetonForge = forger(jwtEncoder, jwtProperties.emetteur(), "gerant",
                List.of("GERANT"));
        mockMvc.perform(get("/api/utilisateurs").header("Authorization", "Bearer " + jetonForge))
                .andExpect(status().isOk());

        String jetonVendeur = forger(jwtEncoder, jwtProperties.emetteur(), "gerant",
                List.of("VENDEUR"));
        mockMvc.perform(get("/api/utilisateurs").header("Authorization", "Bearer " + jetonVendeur))
                .andExpect(status().isForbidden());
    }

    @Test
    void les_entetes_de_securite_sont_poses() throws Exception {
        mockMvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"identifiant":"gerant","motDePasse":"gerant123"}"""))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Referrer-Policy", "no-referrer"))
                .andExpect(header().string("Content-Security-Policy",
                        Matchers.containsString("default-src 'none'")));
    }

    @Test
    void cinq_echecs_bloquent_l_identifiant_avec_un_429_et_un_retry_after() throws Exception {
        String identifiant = "cible.bourrage";

        for (int essai = 1; essai <= 5; essai++) {
            mockMvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                            .content(corpsConnexion(identifiant, "mauvais" + essai)))
                    .andExpect(status().isUnauthorized());
        }

        // 6e tentative : l'identifiant est bloque, meme avec le bon mot de passe.
        mockMvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content(corpsConnexion(identifiant, "peu-importe")))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.statut").value(429))
                .andExpect(jsonPath("$.message")
                        .value(Matchers.containsString("Trop de tentatives")));
    }

    @Test
    void la_casse_de_l_identifiant_ne_contourne_pas_le_compteur() throws Exception {
        String identifiant = "Cible.Casse";

        for (int essai = 1; essai <= 3; essai++) {
            mockMvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                            .content(corpsConnexion(identifiant.toLowerCase(), "x" + essai)))
                    .andExpect(status().isUnauthorized());
        }
        for (int essai = 4; essai <= 5; essai++) {
            mockMvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                            .content(corpsConnexion(identifiant.toUpperCase(), "x" + essai)))
                    .andExpect(status().isUnauthorized());
        }

        mockMvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content(corpsConnexion(identifiant, "x")))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void le_message_d_erreur_ne_revele_pas_si_le_compte_existe() throws Exception {
        String inexistant = mockMvc.perform(post("/api/auth/connexion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpsConnexion("compte.inexistant.xyz", "motdepasse1")))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        String mauvaisMotDePasse = mockMvc.perform(post("/api/auth/connexion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpsConnexion("gerant", "mauvais-mot-de-passe")))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        String messageInexistant = objectMapper.readTree(inexistant).get("message").asText();
        String messageMauvais = objectMapper.readTree(mauvaisMotDePasse).get("message").asText();
        org.assertj.core.api.Assertions.assertThat(messageInexistant)
                .as("les deux cas doivent etre indistinguables")
                .isEqualTo(messageMauvais);
    }

    @Test
    void le_hash_du_mot_de_passe_ne_sort_jamais_de_l_api() throws Exception {
        String jeton = objectMapper.readTree(mockMvc.perform(post("/api/auth/connexion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"identifiant":"gerant","motDePasse":"gerant123"}"""))
                .andReturn().getResponse().getContentAsString()).get("jeton").asText();

        String profil = mockMvc.perform(get("/api/auth/moi")
                        .header("Authorization", "Bearer " + jeton))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String liste = mockMvc.perform(get("/api/utilisateurs")
                        .header("Authorization", "Bearer " + jeton))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        org.assertj.core.api.Assertions.assertThat(profil).doesNotContain("motDePasse", "$2a$");
        org.assertj.core.api.Assertions.assertThat(liste).doesNotContain("motDePasse", "$2a$");
    }

    @Test
    void le_compteur_anti_bourrage_reste_borne_sous_identifiants_aleatoires() throws Exception {
        // L'endpoint de connexion est public : si le compteur grossissait sans
        // limite, le garde-fou anti-bourrage serait lui-meme un deni de service
        // par epuisement memoire.
        for (int essai = 0; essai < 300; essai++) {
            mockMvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                            .content(corpsConnexion("alea-" + java.util.UUID.randomUUID(), "x")))
                    .andExpect(status().isUnauthorized());
        }

        org.assertj.core.api.Assertions.assertThat(tentatives.identifiantsSuivis())
                .as("le nombre d'identifiants suivis doit rester plafonne")
                .isLessThanOrEqualTo(20_000L);
    }

    private String corpsConnexion(String identifiant, String motDePasse) {
        return "{\"identifiant\":\"%s\",\"motDePasse\":\"%s\"}".formatted(identifiant, motDePasse);
    }

    private String forger(JwtEncoder encodeur, String emetteur, String sujet,
                          List<String> roles) {
        return forger(encodeur, emetteur, sujet, roles, versionJetonDe(sujet));
    }

    /**
     * @param versionJeton valeur du claim "jv" ; {@code null} pour l'omettre et
     *                     tester le refus d'un jeton sans version
     */
    private String forger(JwtEncoder encodeur, String emetteur, String sujet,
                          List<String> roles, Long versionJeton) {
        Instant maintenant = Instant.now();
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
                .issuer(emetteur)
                .issuedAt(maintenant)
                .expiresAt(maintenant.plus(1, ChronoUnit.HOURS))
                .subject(sujet);
        if (roles != null) {
            claims.claim("roles", roles);
        }
        if (versionJeton != null) {
            claims.claim("jv", versionJeton);
        }
        return encodeur.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims.build())).getTokenValue();
    }

    /**
     * Lit la version de jetons courante dans un jeton authentique, plutot que de
     * supposer qu'elle vaut 0 : elle change des qu'une revocation a eu lieu.
     */
    private long versionJetonDe(String identifiant) {
        try {
            String jeton = objectMapper.readTree(mockMvc.perform(post("/api/auth/connexion")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(corpsConnexion(identifiant, "gerant123")))
                    .andReturn().getResponse().getContentAsString()).get("jeton").asText();
            String charge = new String(java.util.Base64.getUrlDecoder()
                    .decode(jeton.split("\\.")[1]), StandardCharsets.UTF_8);
            return objectMapper.readTree(charge).get("jv").asLong();
        } catch (Exception echec) {
            throw new IllegalStateException("Lecture de la version de jeton impossible", echec);
        }
    }
}
