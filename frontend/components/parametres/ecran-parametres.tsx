"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Champ, liaisonsChamp, Saisie } from "@/components/ui/champ";
import { IconAlerte, IconCheck, IconFermer } from "@/components/icons";
import { useSession } from "@/components/auth/session";
import { champsErreur, messageErreur, statutHttp } from "@/lib/api";
import { changerMotDePasse } from "@/lib/auth";
import { jeton } from "@/lib/api";
import { notifier } from "@/lib/notifier";
import { libelleRole, libelleSexe, nomComplet } from "@/lib/types";
import { dateLongue } from "@/lib/format";

/** Profil du compte connecté et changement de son mot de passe. */
export function EcranParametres() {
  const { utilisateur } = useSession();

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="h-fit">
        <CardHeader titre="Mon compte" sousTitre="Fiche du compte connecté" />
        <div className="px-5 pb-5">
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <Avatar nom={nomComplet(utilisateur)} />
            <div>
              <p className="text-sm font-semibold text-ink">
                {nomComplet(utilisateur)}
              </p>
              <p className="text-xs text-ink-2">
                {libelleRole(utilisateur)} · {utilisateur.matricule}
              </p>
            </div>
            <span className="ml-auto">
              {utilisateur.actif ? (
                <Badge ton="good" icone={<IconCheck className="h-3.5 w-3.5" />}>
                  Actif
                </Badge>
              ) : (
                <Badge ton="neutre" icone={<IconFermer className="h-3.5 w-3.5" />}>
                  Suspendu
                </Badge>
              )}
            </span>
          </div>

          <dl className="grid gap-x-4 gap-y-3 pt-4 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] text-ink-2">Identifiant</dt>
              <dd className="mt-0.5 font-mono text-[13px] text-ink">
                {utilisateur.identifiant}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-ink-2">Sexe</dt>
              <dd className="mt-0.5 text-[13px] text-ink">
                {libelleSexe(utilisateur.sexe)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-ink-2">Date de naissance</dt>
              <dd className="tnum mt-0.5 text-[13px] text-ink">
                {dateLongue(utilisateur.dateNaissance)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-ink-2">Rôle</dt>
              <dd className="mt-0.5 text-[13px] text-ink">
                {libelleRole(utilisateur)}
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-xs leading-relaxed text-ink-2">
            L’état civil et le rôle ne se modifient pas ici : seul un gérant peut
            les changer, depuis l’écran Utilisateurs.
          </p>
        </div>
      </Card>

      <FormulaireMotDePasse />
    </div>
  );
}

interface EtatMotDePasse {
  champs: Record<string, string>;
  /** Sert de clé au formulaire : l'incrémenter vide les champs saisis. */
  reussites: number;
}

function FormulaireMotDePasse() {
  const router = useRouter();
  // Simple oubli local, et non `seDeconnecter()` : appeler `/auth/deconnexion`
  // ici échouerait, le serveur ayant déjà révoqué le jeton.
  const oublierLeJeton = () => jeton.effacer();

  const [etat, soumettre, enCours] = useActionState<EtatMotDePasse, FormData>(
    async (_precedent, donnees) => {
      const actuel = (donnees.get("motDePasseActuel") as string | null) ?? "";
      const nouveau = (donnees.get("nouveauMotDePasse") as string | null) ?? "";
      const confirmation = (donnees.get("confirmation") as string | null) ?? "";

      // Confirmation purement locale : le serveur ne reçoit qu'un mot de passe.
      if (nouveau !== confirmation) {
        return {
          reussites: _precedent.reussites,
          champs: { confirmation: "Les deux saisies ne correspondent pas." },
        };
      }

      try {
        await changerMotDePasse(actuel, nouveau);
        // Le serveur vient de révoquer tous les jetons du compte, celui-ci
        // compris : rester sur place enverrait la requête suivante en 401 avec
        // un message d'expiration trompeur. On sort proprement.
        oublierLeJeton();
        notifier.apresRedirection(
          "succes",
          "Mot de passe modifié. Reconnectez-vous avec le nouveau.",
        );
        router.replace("/login");
        return { champs: {}, reussites: _precedent.reussites + 1 };
      } catch (erreur) {
        const statut = statutHttp(erreur);
        const champs =
          statut === 401
            ? // Le serveur renvoie son message générique « Identifiant ou mot de
              // passe incorrect » : ici seul le mot de passe actuel est en cause.
              { motDePasseActuel: "Le mot de passe actuel est incorrect." }
            : statut === 409
              ? // « Le nouveau mot de passe doit différer de l'ancien »
                { nouveauMotDePasse: messageErreur(erreur) }
              : champsErreur(erreur);

        // Panne réseau ou 500 : aucun champ en cause, le toast prend le relais.
        if (Object.keys(champs).length === 0) notifier.erreur(messageErreur(erreur));
        return { champs, reussites: _precedent.reussites };
      }
    },
    { champs: {}, reussites: 0 },
  );

  const erreur = (cle: string) => etat.champs[cle];

  return (
    <Card className="h-fit">
      <CardHeader
        titre="Changer mon mot de passe"
        sousTitre="Huit caractères au moins, différent de l’actuel."
      />
      {/* `key` : après un changement réussi, le formulaire est remonté, donc vidé. */}
      <form key={etat.reussites} action={soumettre} className="px-5 pb-5">
        <div className="grid gap-4">
          <Champ
            id="motDePasseActuel"
            libelle="Mot de passe actuel"
            obligatoire
            erreur={erreur("motDePasseActuel")}
          >
            <Saisie
              {...liaisonsChamp("motDePasseActuel", erreur("motDePasseActuel"))}
              name="motDePasseActuel"
              type="password"
              required
              autoComplete="current-password"
              erreur={erreur("motDePasseActuel")}
            />
          </Champ>

          <Champ
            id="nouveauMotDePasse"
            libelle="Nouveau mot de passe"
            obligatoire
            erreur={erreur("nouveauMotDePasse")}
            indice="8 à 72 caractères."
          >
            <Saisie
              {...liaisonsChamp("nouveauMotDePasse", erreur("nouveauMotDePasse"), true)}
              name="nouveauMotDePasse"
              type="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              erreur={erreur("nouveauMotDePasse")}
            />
          </Champ>

          <Champ
            id="confirmation"
            libelle="Confirmer le nouveau mot de passe"
            obligatoire
            erreur={erreur("confirmation")}
          >
            <Saisie
              {...liaisonsChamp("confirmation", erreur("confirmation"))}
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

        <button
          type="submit"
          disabled={enCours}
          className="mt-5 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-brand-500 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-600 disabled:cursor-progress disabled:bg-brand-500/60"
        >
          {enCours ? "Changement…" : "Changer le mot de passe"}
        </button>

        <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-ink-2">
          <IconAlerte className="mt-px h-3.5 w-3.5 shrink-0 text-ink-3" />
          Le changement déconnecte tous vos appareils, celui-ci compris : vous
          devrez vous reconnecter avec le nouveau mot de passe.
        </p>
      </form>
    </Card>
  );
}
