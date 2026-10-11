package com.boutique.backend.security;

import com.boutique.backend.model.Utilisateur;
import java.time.Instant;
import java.util.List;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

/** Émission des jetons. Isolé du service métier pour que celui-ci ignore le format du jeton. */
@Service
public class JwtService {

    private final JwtEncoder jwtEncoder;
    private final JwtProperties proprietes;

    public JwtService(JwtEncoder jwtEncoder, JwtProperties proprietes) {
        this.jwtEncoder = jwtEncoder;
        this.proprietes = proprietes;
    }

    public String genererPour(Utilisateur utilisateur) {
        Instant maintenant = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(proprietes.emetteur())
                .issuedAt(maintenant)
                .expiresAt(maintenant.plus(proprietes.duree()))
                .subject(utilisateur.getIdentifiant())
                .claim("uid", utilisateur.getId())
                .claim("roles", List.of(utilisateur.getRole().name()))
                // Version des jetons du porteur : permet la révocation cote serveur.
                .claim("jv", utilisateur.versionJeton())
                .build();

        JwsHeader entete = JwsHeader.with(MacAlgorithm.HS256).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(entete, claims)).getTokenValue();
    }

    public long dureeEnSecondes() {
        return proprietes.duree().toSeconds();
    }
}
