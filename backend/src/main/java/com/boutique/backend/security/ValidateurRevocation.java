package com.boutique.backend.security;

import com.boutique.backend.dto.EtatCompte;
import com.boutique.backend.repository.UtilisateurRepository;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

/**
 * Rend révocable un jeton qui, par nature, est autoporteur.
 *
 * <p>Chaque jeton embarque dans le claim {@code jv} la version des jetons de son
 * porteur au moment de l'émission. À chaque requête, cette version est comparée
 * à celle stockée en base : changement de mot de passe, changement de rôle,
 * désactivation ou déconnexion globale incrémentent le compteur et invalident
 * donc instantanément tout ce qui a été émis avant.
 *
 * <p>C'est le compromis assumé du JWT sans état : une lecture en base par
 * requête authentifiée, sur l'index unique de l'identifiant et limitée à deux
 * colonnes. Si ce coût devenait visible, la suite serait un cache en mémoire
 * invalidé à l'écriture, pas la suppression de ce contrôle.
 */
@Component
public class ValidateurRevocation implements OAuth2TokenValidator<Jwt> {

    private static final Logger log = LoggerFactory.getLogger(ValidateurRevocation.class);
    private static final String CLAIM_VERSION = "jv";

    private final UtilisateurRepository utilisateurRepository;

    public ValidateurRevocation(UtilisateurRepository utilisateurRepository) {
        this.utilisateurRepository = utilisateurRepository;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt jeton) {
        String identifiant = jeton.getSubject();

        Long versionDuJeton = versionDeclaree(jeton);
        if (versionDuJeton == null) {
            return echec("Jeton sans version : réauthentifiez-vous");
        }

        Optional<EtatCompte> etat = utilisateurRepository.etatDuCompte(identifiant);
        if (etat.isEmpty()) {
            log.warn("Jeton valide pour un compte inexistant : '{}'", identifiant);
            return echec("Ce compte n'existe plus");
        }
        if (!etat.get().actif()) {
            log.warn("Jeton presente par le compte desactive '{}'", identifiant);
            return echec("Ce compte est désactivé");
        }
        if (versionDuJeton != etat.get().versionJeton()) {
            log.info("Jeton revoque pour '{}' (version {} contre {})",
                    identifiant, versionDuJeton, etat.get().versionJeton());
            return echec("Jeton révoqué : réauthentifiez-vous");
        }

        return OAuth2TokenValidatorResult.success();
    }

    /** @return la version déclarée, ou {@code null} si le claim est absent ou mal typé */
    private Long versionDeclaree(Jwt jeton) {
        Object brut = jeton.getClaim(CLAIM_VERSION);
        return brut instanceof Number nombre ? nombre.longValue() : null;
    }

    private OAuth2TokenValidatorResult echec(String description) {
        return OAuth2TokenValidatorResult.failure(
                new OAuth2Error("invalid_token", description, null));
    }
}
