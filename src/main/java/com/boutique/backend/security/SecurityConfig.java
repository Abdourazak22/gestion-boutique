package com.boutique.backend.security;

import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    /** Documentation OpenAPI : ouverte en développement, fermée en production. */
    private static final String[] ROUTES_DOCUMENTATION = {
            "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html"
    };

    private final SecuriteProperties proprietes;

    public SecurityConfig(SecuriteProperties proprietes) {
        this.proprietes = proprietes;
    }

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                // Pas de cookie de session, donc pas de vecteur CSRF : l'appelant
                // doit présenter un Bearer que le navigateur n'ajoute pas tout seul.
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(headers -> headers
                        .frameOptions(frame -> frame.deny())
                        .contentTypeOptions(Customizer.withDefaults())
                        // API JSON : aucune ressource à charger, donc tout est interdit.
                        .contentSecurityPolicy(csp ->
                                csp.policyDirectives("default-src 'none'; frame-ancestors 'none'"))
                        .referrerPolicy(referrer -> referrer.policy(
                                org.springframework.security.web.header.writers
                                        .ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER)))
                .authorizeHttpRequests(auth -> {
                    auth.requestMatchers(HttpMethod.POST, "/api/auth/connexion").permitAll();
                    if (proprietes.documentationPublique()) {
                        auth.requestMatchers(ROUTES_DOCUMENTATION).permitAll();
                    }
                    auth.anyRequest().authenticated();
                })
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())))
                .build();
    }

    /** Mappe le claim "roles" du jeton vers des authorities ROLE_*. */
    private JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter authorities = new JwtGrantedAuthoritiesConverter();
        authorities.setAuthoritiesClaimName("roles");
        authorities.setAuthorityPrefix("ROLE_");

        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(authorities);
        return converter;
    }

    @Bean
    AuthenticationManager authenticationManager(UserDetailsService utilisateurs,
                                                PasswordEncoder encodeur) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(utilisateurs);
        provider.setPasswordEncoder(encodeur);
        // Laisse le provider convertir UsernameNotFoundException en BadCredentials
        // et consommer le temps d'un hash factice : pas d'énumération des comptes,
        // ni par le message d'erreur, ni par le temps de réponse.
        provider.setHideUserNotFoundExceptions(true);
        return new ProviderManager(provider);
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(proprietes.bcryptForce());
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(proprietes.originesAutorisees());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        // Le jeton voyage dans Authorization ; aucun cookie n'est échangé, donc
        // pas d'allowCredentials et pas de risque de requête authentifiée implicite.
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setExposedHeaders(List.of("Content-Disposition"));
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
