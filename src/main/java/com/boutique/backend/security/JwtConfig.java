package com.boutique.backend.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Objects;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

/** Fabrique les briques de signature et de vérification des jetons. */
@Configuration
public class JwtConfig {

    /** Décalage d'horloge toléré entre l'émission et la vérification. */
    private static final Duration TOLERANCE_HORLOGE = Duration.ofSeconds(30);

    private final SecretKey cle;
    private final JwtProperties proprietes;

    public JwtConfig(JwtProperties proprietes) {
        this.proprietes = proprietes;
        this.cle = new SecretKeySpec(
                proprietes.secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    @Bean
    JwtEncoder jwtEncoder() {
        return new NimbusJwtEncoder(new ImmutableSecret<>(cle));
    }

    /**
     * Le décodeur ne se contente pas de vérifier la signature et l'expiration :
     * il impose aussi l'émetteur attendu, la présence d'un sujet et de rôles,
     * puis délègue à {@link ValidateurRevocation} qui rend le jeton révocable.
     */
    @Bean
    JwtDecoder jwtDecoder(ValidateurRevocation revocation) {
        NimbusJwtDecoder decodeur = NimbusJwtDecoder.withSecretKey(cle)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();

        decodeur.setJwtValidator(new DelegatingOAuth2TokenValidator<Jwt>(
                new JwtTimestampValidator(TOLERANCE_HORLOGE),
                new JwtIssuerValidator(proprietes.emetteur()),
                new JwtClaimValidator<String>(JwtClaimNames.SUB, Objects::nonNull),
                new JwtClaimValidator<Object>("roles", Objects::nonNull),
                revocation));

        return decodeur;
    }
}
