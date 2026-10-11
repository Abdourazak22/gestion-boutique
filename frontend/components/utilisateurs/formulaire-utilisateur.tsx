"use client";

import { useActionState } from "react";
import { Champ, liaisonsChamp, Liste, Saisie } from "@/components/ui/champ";
import { Dialogue } from "@/components/ui/dialogue";
import { PiedFormulaire } from "@/components/ui/pied-formulaire";
import { champsErreur } from "@/lib/api";
import { notifier } from "@/lib/notifier";
import {
  creerUtilisateur,
  modifierUtilisateur,
  type UtilisateurRequete,
} from "@/lib/utilisateurs";
import { nomComplet, type Role, type Sexe, type Utilisateur } from "@/lib/types";

/**
 * Création et modification d'un compte du personnel.
 *
 * À la modification, l'identifiant et le mot de passe disparaissent du
 * formulaire : `UtilisateurUpdateRequest` ne les accepte pas. L'identifiant est
 * la clé de connexion, et le mot de passe ne se change que par son porteur
 * (`PATCH /api/auth/mot-de-passe`).
 */

interface EtatFormulaire {
  champs: Record<string, string>;
  valeurs: Record<string, string>;
}

const CHAMPS_COMMUNS = ["nom", "prenom", "matricule", "sexe", "dateNaissance", "role"];

const texte = (donnees: FormData, cle: string): string =>
  (donnees.get(cle) as string | null)?.trim() ?? "";

export function FormulaireUtilisateur({
  utilisateur,
  onFermer,
  onEnregistre,
}: {
  /** Absent : création. Présent : modification de ce compte. */
  utilisateur?: Utilisateur;
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const modification = utilisateur !== undefined;

  const [etat, soumettre, enCours] = useActionState<EtatFormulaire, FormData>(
    async (_precedent, donnees) => {
      const cles = modification
        ? CHAMPS_COMMUNS
        : [...CHAMPS_COMMUNS, "identifiant", "motDePasse"];
      const valeurs = Object.fromEntries(
        cles.map((cle) => [cle, texte(donnees, cle)]),
      );

      const commun = {
        nom: valeurs.nom!,
        prenom: valeurs.prenom!,
        matricule: valeurs.matricule!,
        sexe: valeurs.sexe as Sexe,
        dateNaissance: valeurs.dateNaissance!,
        role: valeurs.role as Role,
      };

      try {
        if (modification) {
          await notifier.pendant(modifierUtilisateur(utilisateur.id, commun), {
            attente: "Enregistrement…",
            succes: (u) => `Fiche de ${nomComplet(u)} mise à jour.`,
          });
        } else {
          const requete: UtilisateurRequete = {
            ...commun,
            identifiant: valeurs.identifiant!,
            motDePasse: valeurs.motDePasse!,
          };
          await notifier.pendant(creerUtilisateur(requete), {
            attente: "Création du compte…",
            succes: (u) => `Compte de ${nomComplet(u)} créé.`,
          });
        }
        onEnregistre();
        onFermer();
        return { champs: {}, valeurs: {} };
      } catch (erreur) {
        return { valeurs, champs: champsErreur(erreur) };
      }
    },
    { champs: {}, valeurs: {} },
  );

  // Au premier rendu l'état est vide : on retombe sur la fiche à modifier.
  const valeur = (cle: string, defaut = "") => etat.valeurs[cle] ?? defaut;
  const erreur = (cle: string) => etat.champs[cle];

  return (
    <Dialogue
      ouvert
      titre={modification ? "Modifier le compte" : "Ajouter un utilisateur"}
      description={
        modification
          ? `Identifiant « ${utilisateur.identifiant} », non modifiable.`
          : "Les champs marqués d’une étoile sont obligatoires."
      }
      onFermer={onFermer}
    >
      <form action={soumettre} className="px-5 py-5">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ id="prenom" libelle="Prénom" obligatoire erreur={erreur("prenom")}>
              <Saisie
                {...liaisonsChamp("prenom", erreur("prenom"))}
                name="prenom"
                required
                maxLength={60}
                autoFocus
                defaultValue={valeur("prenom", utilisateur?.prenom)}
                erreur={erreur("prenom")}
              />
            </Champ>
            <Champ id="nom" libelle="Nom" obligatoire erreur={erreur("nom")}>
              <Saisie
                {...liaisonsChamp("nom", erreur("nom"))}
                name="nom"
                required
                maxLength={60}
                defaultValue={valeur("nom", utilisateur?.nom)}
                erreur={erreur("nom")}
              />
            </Champ>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Champ
              id="matricule"
              libelle="Matricule"
              obligatoire
              erreur={erreur("matricule")}
            >
              <Saisie
                {...liaisonsChamp("matricule", erreur("matricule"))}
                name="matricule"
                required
                maxLength={30}
                placeholder="MAT-0042"
                defaultValue={valeur("matricule", utilisateur?.matricule)}
                erreur={erreur("matricule")}
              />
            </Champ>

            <Champ id="sexe" libelle="Sexe" obligatoire erreur={erreur("sexe")}>
              <Liste
                {...liaisonsChamp("sexe", erreur("sexe"))}
                name="sexe"
                required
                defaultValue={valeur("sexe", utilisateur?.sexe ?? "FEMININ")}
                erreur={erreur("sexe")}
              >
                <option value="FEMININ">Féminin</option>
                <option value="MASCULIN">Masculin</option>
              </Liste>
            </Champ>

            <Champ id="role" libelle="Rôle" obligatoire erreur={erreur("role")}>
              <Liste
                {...liaisonsChamp("role", erreur("role"))}
                name="role"
                required
                defaultValue={valeur("role", utilisateur?.role ?? "VENDEUR")}
                erreur={erreur("role")}
              >
                <option value="VENDEUR">Vendeur</option>
                <option value="GERANT">Gérant</option>
              </Liste>
            </Champ>
          </div>

          <Champ
            id="dateNaissance"
            libelle="Date de naissance"
            obligatoire
            erreur={erreur("dateNaissance")}
            indice="Doit être dans le passé."
          >
            <Saisie
              {...liaisonsChamp("dateNaissance", erreur("dateNaissance"), true)}
              name="dateNaissance"
              type="date"
              required
              defaultValue={valeur("dateNaissance", utilisateur?.dateNaissance)}
              erreur={erreur("dateNaissance")}
            />
          </Champ>

          {modification ? null : (
            <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
              <Champ
                id="identifiant"
                libelle="Identifiant de connexion"
                obligatoire
                erreur={erreur("identifiant")}
                indice="3 à 50 caractères : lettres, chiffres, . - _"
              >
                <Saisie
                  {...liaisonsChamp("identifiant", erreur("identifiant"), true)}
                  name="identifiant"
                  required
                  minLength={3}
                  maxLength={50}
                  pattern="[a-zA-Z0-9._\-]+"
                  placeholder="awa.kone"
                  autoComplete="off"
                  defaultValue={valeur("identifiant")}
                  erreur={erreur("identifiant")}
                />
              </Champ>

              <Champ
                id="motDePasse"
                libelle="Mot de passe initial"
                obligatoire
                erreur={erreur("motDePasse")}
                indice="8 caractères au moins."
              >
                <Saisie
                  {...liaisonsChamp("motDePasse", erreur("motDePasse"), true)}
                  name="motDePasse"
                  type="password"
                  required
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  defaultValue={valeur("motDePasse")}
                  erreur={erreur("motDePasse")}
                />
              </Champ>
            </div>
          )}
        </div>

        <PiedFormulaire
          onFermer={onFermer}
          enCours={enCours}
          soumettre={modification ? "Enregistrer" : "Créer le compte"}
        />
      </form>
    </Dialogue>
  );
}
