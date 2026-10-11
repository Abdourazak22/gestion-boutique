package com.boutique.backend.config;

import com.boutique.backend.model.Role;
import com.boutique.backend.model.Sexe;
import com.boutique.backend.model.Utilisateur;
import com.boutique.backend.service.UtilisateurService;
import java.time.LocalDate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * Crée le compte gérant initial pour pouvoir se connecter la première fois.
 * Actif hors production uniquement.
 */
@Configuration
@Profile("!prod")
public class DonneesInitiales {

    private static final Logger log = LoggerFactory.getLogger(DonneesInitiales.class);

    @Bean
    ApplicationRunner creerGerantParDefaut(UtilisateurService utilisateurService) {
        return args -> {
            if (utilisateurService.identifiantExiste("gerant")) {
                return;
            }
            utilisateurService.creer(Utilisateur.builder()
                    .nom("Ouattara")
                    .prenom("Gerant")
                    .matricule("MAT-0001")
                    .sexe(Sexe.MASCULIN)
                    .dateNaissance(LocalDate.of(1985, 1, 15))
                    .identifiant("gerant")
                    .role(Role.GERANT)
                    .build(), "gerant123");
            log.info("Compte gérant initial créé : identifiant=gerant / mot de passe=gerant123");
        };
    }
}
