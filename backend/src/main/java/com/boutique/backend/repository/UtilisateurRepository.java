package com.boutique.backend.repository;

import com.boutique.backend.dto.EtatCompte;
import com.boutique.backend.model.Role;
import com.boutique.backend.model.Utilisateur;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UtilisateurRepository extends JpaRepository<Utilisateur, Long> {

    Optional<Utilisateur> findByIdentifiant(String identifiant);

    boolean existsByIdentifiant(String identifiant);

    boolean existsByMatricule(String matricule);

    long countByRoleAndActifTrue(Role role);

    /**
     * Lu à chaque requête authentifiée : on ne récupère que les deux colonnes
     * nécessaires, sur l'index unique de l'identifiant.
     */
    @Query("select new com.boutique.backend.dto.EtatCompte(u.actif, u.jetonVersion) "
            + "from Utilisateur u where u.identifiant = :identifiant")
    Optional<EtatCompte> etatDuCompte(String identifiant);
}
