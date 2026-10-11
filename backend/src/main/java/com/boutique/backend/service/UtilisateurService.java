package com.boutique.backend.service;

import com.boutique.backend.dto.ChangementMotDePasseRequest;
import com.boutique.backend.dto.ReinitialisationMotDePasseRequest;
import com.boutique.backend.dto.UtilisateurRequest;
import com.boutique.backend.dto.UtilisateurResponse;
import com.boutique.backend.dto.UtilisateurUpdateRequest;
import com.boutique.backend.exception.ConflitException;
import com.boutique.backend.exception.RessourceIntrouvableException;
import com.boutique.backend.model.Role;
import com.boutique.backend.model.Utilisateur;
import com.boutique.backend.repository.UtilisateurRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UtilisateurService {

    private final UtilisateurRepository utilisateurRepository;
    private final PasswordEncoder encodeur;

    public UtilisateurService(UtilisateurRepository utilisateurRepository,
                              PasswordEncoder encodeur) {
        this.utilisateurRepository = utilisateurRepository;
        this.encodeur = encodeur;
    }

    public Utilisateur parIdentifiant(String identifiant) {
        return utilisateurRepository.findByIdentifiant(identifiant)
                .orElseThrow(() -> RessourceIntrouvableException.de("Utilisateur", identifiant));
    }

    public UtilisateurResponse parId(Long id) {
        return UtilisateurResponse.de(parIdOuErreur(id));
    }

    public Page<UtilisateurResponse> lister(Pageable pagination) {
        return utilisateurRepository.findAll(pagination).map(UtilisateurResponse::de);
    }

    /** Ajout d'un utilisateur par le gérant. */
    @Transactional
    public UtilisateurResponse creer(UtilisateurRequest requete) {
        Utilisateur utilisateur = Utilisateur.builder()
                .nom(requete.nom().trim())
                .prenom(requete.prenom().trim())
                .matricule(requete.matricule().trim())
                .sexe(requete.sexe())
                .dateNaissance(requete.dateNaissance())
                .identifiant(requete.identifiant().trim())
                .role(requete.role())
                .build();
        return UtilisateurResponse.de(creer(utilisateur, requete.motDePasse()));
    }

    /**
     * Enregistre un nouvel utilisateur en hachant son mot de passe.
     *
     * @param motDePasseEnClair mot de passe saisi, jamais persisté tel quel
     */
    @Transactional
    public Utilisateur creer(Utilisateur utilisateur, String motDePasseEnClair) {
        if (utilisateurRepository.existsByIdentifiant(utilisateur.getIdentifiant())) {
            throw new ConflitException(
                    "L'identifiant " + utilisateur.getIdentifiant() + " est déjà utilisé");
        }
        if (utilisateurRepository.existsByMatricule(utilisateur.getMatricule())) {
            throw new ConflitException(
                    "Le matricule " + utilisateur.getMatricule() + " est déjà utilisé");
        }
        utilisateur.setMotDePasse(encodeur.encode(motDePasseEnClair));
        return utilisateurRepository.save(utilisateur);
    }

    @Transactional
    public UtilisateurResponse modifier(Long id, UtilisateurUpdateRequest requete) {
        Utilisateur utilisateur = parIdOuErreur(id);

        if (!utilisateur.getMatricule().equals(requete.matricule().trim())
                && utilisateurRepository.existsByMatricule(requete.matricule().trim())) {
            throw new ConflitException(
                    "Le matricule " + requete.matricule() + " est déjà utilisé");
        }
        refuserLeDernierGerant(utilisateur, requete.role() != Role.GERANT);

        boolean roleChange = utilisateur.getRole() != requete.role();

        utilisateur.setNom(requete.nom().trim());
        utilisateur.setPrenom(requete.prenom().trim());
        utilisateur.setMatricule(requete.matricule().trim());
        utilisateur.setSexe(requete.sexe());
        utilisateur.setDateNaissance(requete.dateNaissance());
        utilisateur.setRole(requete.role());

        // Le role est inscrit dans le jeton : sans revocation, un gerant
        // rétrogradé garderait ses droits jusqu'a expiration.
        if (roleChange) {
            utilisateur.revoquerLesJetons();
        }

        return UtilisateurResponse.de(utilisateur);
    }

    /**
     * Active ou désactive un compte. La désactivation révoque aussi les jetons
     * en cours : sinon le compte resterait utilisable jusqu'a leur expiration,
     * le contrôle de {@code actif} n'ayant lieu qu'a la connexion.
     */
    @Transactional
    public UtilisateurResponse changerStatut(Long id, boolean actif) {
        Utilisateur utilisateur = parIdOuErreur(id);
        refuserLeDernierGerant(utilisateur, !actif);
        utilisateur.setActif(actif);
        if (!actif) {
            utilisateur.revoquerLesJetons();
        }
        return UtilisateurResponse.de(utilisateur);
    }

    /**
     * Déconnexion globale : invalide tous les jetons déjà émis pour ce compte.
     * Utilisé par l'utilisateur lui-même et par le gérant en cas d'appareil perdu.
     */
    @Transactional
    public void revoquerLesJetons(String identifiant) {
        parIdentifiant(identifiant).revoquerLesJetons();
    }

    @Transactional
    public UtilisateurResponse revoquerLesJetons(Long id) {
        Utilisateur utilisateur = parIdOuErreur(id);
        utilisateur.revoquerLesJetons();
        return UtilisateurResponse.de(utilisateur);
    }

    /**
     * Changement de mot de passe par l'utilisateur lui-même. Révoque au passage
     * tous ses jetons : il devra se reconnecter, y compris sur ses autres appareils.
     */
    @Transactional
    public void changerMotDePasse(String identifiant, ChangementMotDePasseRequest requete) {
        Utilisateur utilisateur = parIdentifiant(identifiant);
        if (!encodeur.matches(requete.motDePasseActuel(), utilisateur.getMotDePasse())) {
            throw new BadCredentialsException("Mot de passe actuel incorrect");
        }
        if (encodeur.matches(requete.nouveauMotDePasse(), utilisateur.getMotDePasse())) {
            throw new ConflitException("Le nouveau mot de passe doit différer de l'ancien");
        }
        utilisateur.setMotDePasse(encodeur.encode(requete.nouveauMotDePasse()));
        // Les jetons émis avec l'ancien mot de passe ne valent plus rien.
        utilisateur.revoquerLesJetons();
    }

    /**
     * Réinitialisation par le gérant du mot de passe d'un employé qui a perdu
     * le sien. Sans elle, un oubli condamnait le compte : seul son propriétaire
     * pouvait le changer, et seulement en connaissant l'ancien.
     *
     * <p>Révoque les jetons du compte : si la réinitialisation suit un vol
     * d'appareil, laisser les sessions ouvertes viderait l'opération de son
     * sens.
     *
     * <p>Interdite sur son propre compte, et ce n'est pas une gêne inutile :
     * une session de gérant détournée pourrait sinon changer le mot de passe
     * sans connaître l'ancien, et verrouiller le vrai gérant dehors. Pour le
     * sien, {@link #changerMotDePasse} exige le mot de passe actuel.
     *
     * @param identifiantAuteur le gérant qui demande, lu dans son jeton
     * @throws ConflitException si le gérant vise son propre compte
     */
    @Transactional
    public UtilisateurResponse reinitialiserMotDePasse(Long id, String identifiantAuteur,
                                                       ReinitialisationMotDePasseRequest requete) {
        Utilisateur utilisateur = parIdOuErreur(id);

        if (utilisateur.getIdentifiant().equals(identifiantAuteur)) {
            throw new ConflitException("Pour changer votre propre mot de passe, "
                    + "passez par vos paramètres : l'actuel y est demandé");
        }

        utilisateur.setMotDePasse(encodeur.encode(requete.nouveauMotDePasse()));
        utilisateur.revoquerLesJetons();

        return UtilisateurResponse.de(utilisateur);
    }

    public boolean identifiantExiste(String identifiant) {
        return utilisateurRepository.existsByIdentifiant(identifiant);
    }

    private Utilisateur parIdOuErreur(Long id) {
        return utilisateurRepository.findById(id)
                .orElseThrow(() -> RessourceIntrouvableException.de("Utilisateur", id));
    }

    /**
     * Interdit de retirer le dernier gérant actif, sinon plus personne ne peut
     * administrer l'application.
     *
     * @param perdLeRoleGerant vrai si l'opération ôte à cet utilisateur son statut
     *                         de gérant actif
     */
    private void refuserLeDernierGerant(Utilisateur utilisateur, boolean perdLeRoleGerant) {
        if (!perdLeRoleGerant || utilisateur.getRole() != Role.GERANT || !utilisateur.isActif()) {
            return;
        }
        if (utilisateurRepository.countByRoleAndActifTrue(Role.GERANT) <= 1) {
            throw new ConflitException(
                    "Impossible : c'est le dernier gérant actif de l'application");
        }
    }
}
