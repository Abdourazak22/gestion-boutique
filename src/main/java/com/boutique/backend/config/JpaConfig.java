package com.boutique.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/** Active le renseignement automatique des colonnes cree_le / modifie_le. */
@Configuration
@EnableJpaAuditing
public class JpaConfig {
}
