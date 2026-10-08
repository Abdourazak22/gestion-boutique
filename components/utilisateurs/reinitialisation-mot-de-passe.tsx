"use client";

import { useActionState } from "react";
import { Champ, liaisonsChamp, Saisie } from "@/components/ui/champ";
import { Dialogue } from "@/components/ui/dialogue";
import { PiedFormulaire } from "@/components/ui/pied-formulaire";
import { champsErreur } from "@/lib/api";
import { notifier } from "@/lib/notifier";
import { reinitialiserMotDePasse } from "@/lib/utilisateurs";
import { nomComplet, type Utilisateur } from "@/lib/types";

/**
 * Réinitialisation par le gérant du mot de passe d'un employé qui a perdu le
 * sien (`PATCH /api/utilisateurs/{id}/mot-de-passe`).
 *
 * L'ancien n'est pas demandé : plus personne ne le connaît, c'est la raison
 * d'être de l'écran. Le gérant saisit le nouveau et le communique de vive voix
 * à l'employé, qui pourra le changer ensuite depuis ses paramètres.
 */
interface EtatFormulaire {
  champs: Record<string, string>;
}

const VIDE: EtatFormulaire = { champs: {} };

const texte = (donnees: FormData, cle: string): string =>
  (donnees.get(cle) as string | null) ?? "";

export function ReinitialisationMotDePasse({
  utilisateur,
  onFermer,
  onReinitialise,
}: {
  utilisateur: Utilisateur;
  onFermer: () => void;
  onReinitialise: () => void;
}) {
  const [etat, soumettre, enCours] = useActionState<EtatFormulaire, FormData>(
    async (_precedent, donnees) => {
      const nouveau = texte(donnees, "nouveauMotDePasse");
      const confirmation = texte(donnees, "confirmation");

      // Un mot de passe mal retapé enfermerait l'employé dehors une seconde
      // fois : la comparaison se fait ici, le serveur ne voit qu'une valeur.
      if (nouveau !== confirmation) {
        return { champs: { confirmation: "Les deux saisies diffèrent." } };
      }

      try {
        await notifier.pendant(reinitialiserMotDePasse(utilisateur.id, nouveau), {
          attente: "Réinitialisation…",
          succes: `Mot de passe de ${nomComplet(utilisateur)} réinitialisé.`,
        });
        onReinitialise();
        onFermer();
        return VIDE;
      } catch (erreur) {
        return { champs: champsErreur(erreur) };
      }
    },
    VIDE,
  );

  const erreur = (cle: string) => etat.champs[cle];

  return (
    <Dialogue
      ouvert
      titre={`Réinitialiser le mot de passe · ${nomComplet(utilisateur)}`}
      description="L’ancien mot de passe n’est pas nécessaire."
      onFermer={onFermer}
    >
      <form action={soumettre} className="px-5 py-5">
        <div className="grid gap-4">
          <p className="rounded-lg border border-line bg-plane px-4 py-2.5 text-[13px] text-ink-2">
            Communiquez ce mot de passe à {utilisateur.prenom}, qui pourra le
            changer depuis ses paramètres. Ses sessions ouvertes seront fermées.
          </p>

          <Champ
            id="nouveauMotDePasse"
            libelle="Nouveau mot de passe"
            obligatoire
            erreur={erreur("nouveauMotDePasse")}
            indice="8 caractères au moins."
          >
            <Saisie
              {...liaisonsChamp("nouveauMotDePasse", erreur("nouveauMotDePasse"), true)}
              name="nouveauMotDePasse"
              type="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              autoFocus
              erreur={erreur("nouveauMotDePasse")}
            />
          </Champ>

          <Champ
            id="confirmation"
            libelle="Confirmer le mot de passe"
            obligatoire
            erreur={erreur("confirmation")}
          >
            <Saisie
              {...liaisonsChamp("confirmation", erreur("confirmation"), true)}
              name="confirmation"
              type="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              erreur={erreur("confirmation")}
            />
          </Champ>
        </div>

        <PiedFormulaire
          onFermer={onFermer}
          enCours={enCours}
          soumettre="Réinitialiser"
          enCoursLibelle="Réinitialisation…"
        />
      </form>
    </Dialogue>
  );
}
