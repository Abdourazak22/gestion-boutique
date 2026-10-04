"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Erreur, PageHorsLimites, Squelette, Vide } from "@/components/ui/etats";
import { BoutonPrincipal, EntetePage } from "@/components/ui/entete-page";
import { Pagination } from "@/components/produits/catalogue";
import { IconCheck, IconFermer, IconPlus } from "@/components/icons";
import { useSession } from "@/components/auth/session";
import { FormulaireUtilisateur } from "@/components/utilisateurs/formulaire-utilisateur";
import { notifier } from "@/lib/notifier";
import { useRequete } from "@/lib/requete";
import {
  changerStatutUtilisateur,
  deconnecterUtilisateur,
  listerUtilisateurs,
} from "@/lib/utilisateurs";
import { libelleRole, libelleSexe, nomComplet, type Utilisateur } from "@/lib/types";
import { dateLongue } from "@/lib/format";

const PAR_PAGE = 20;

/**
 * Gestion du personnel (`/api/utilisateurs`, réservé au gérant).
 *
 * Un vendeur n'a rien à voir ici : le contrôleur entier est annoté
 * `@PreAuthorize("hasRole('GERANT')")`, l'écran se contente donc de le dire
 * plutôt que d'afficher un tableau qui se solderait par un 403.
 */
export function EcranUtilisateurs() {
  const { utilisateur: connecte } = useSession();
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState(0);
  const [creation, setCreation] = useState(false);
  const [enModification, setEnModification] = useState<Utilisateur | null>(null);
  const [statutEnCours, setStatutEnCours] = useState<number | null>(null);
  const [deconnexionEnCours, setDeconnexionEnCours] = useState<number | null>(null);

  const estGerant = connecte.role === "GERANT";

  const { donnees, chargement, erreur, recharger } = useRequete(
    `utilisateurs?page=${page}&v=${version}`,
    (signal) =>
      estGerant
        ? listerUtilisateurs({ page, size: PAR_PAGE }, signal)
        : Promise.resolve(null),
  );

  async function basculerStatut(u: Utilisateur) {
    setStatutEnCours(u.id);
    try {
      await notifier.pendant(changerStatutUtilisateur(u.id, !u.actif), {
        attente: u.actif ? "Désactivation…" : "Réactivation…",
        succes: (maj) =>
          `Compte de ${nomComplet(maj)} ${maj.actif ? "réactivé" : "désactivé"}.`,
      });
      setVersion((v) => v + 1);
    } catch {
      // Dernier gérant actif, compte introuvable : le serveur l'a dit via le toast.
    } finally {
      setStatutEnCours(null);
    }
  }

  async function deconnecterPartout(u: Utilisateur) {
    setDeconnexionEnCours(u.id);
    try {
      await notifier.pendant(deconnecterUtilisateur(u.id), {
        attente: "Révocation des sessions…",
        succes: (maj) => `Sessions de ${nomComplet(maj)} révoquées.`,
      });
      // Se révoquer soi-même invalide le jeton courant : la requête suivante
      // partira en 401 et l'intercepteur renverra vers la connexion.
      if (u.id === connecte.id) {
        notifier.apresRedirection(
          "succes",
          "Vos sessions ont été révoquées, reconnectez-vous.",
        );
      }
      setVersion((v) => v + 1);
    } catch {
      // Compte introuvable : le serveur l'a déjà dit via le toast.
    } finally {
      setDeconnexionEnCours(null);
    }
  }

  if (!estGerant) {
    return (
      <>
        <EntetePage
          titre="Utilisateurs"
          sousTitre="Comptes autorisés à se connecter à l’application et à encaisser."
        />
        <Vide
          titre="Réservé au gérant"
          indice="L’administration des comptes du personnel n’est accessible qu’avec le rôle gérant."
        />
      </>
    );
  }

  return (
    <>
      <EntetePage
        titre="Utilisateurs"
        sousTitre="Comptes autorisés à se connecter à l’application et à encaisser."
        actions={
          <BoutonPrincipal onClick={() => setCreation(true)}>
            <IconPlus className="h-4 w-4" />
            Ajouter un utilisateur
          </BoutonPrincipal>
        }
      />

      {erreur ? (
        <Erreur message={erreur} onReessayer={recharger} />
      ) : chargement ? (
        <Squelette className="h-80" />
      ) : donnees && donnees.content.length === 0 ? (
        donnees.page.totalElements > 0 ? (
          <PageHorsLimites onRetour={() => setPage(0)} />
        ) : (
          <Vide titre="Aucun compte enregistré" />
        )
      ) : (
        <>
          <Card>
            <CardHeader
              titre="Comptes"
              sousTitre={`${donnees?.page.totalElements ?? 0} compte${
                (donnees?.page.totalElements ?? 0) > 1 ? "s" : ""
              } enregistré${(donnees?.page.totalElements ?? 0) > 1 ? "s" : ""}`}
            />
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full min-w-[860px] text-left text-sm">
                <caption className="sr-only">
                  Liste des utilisateurs avec matricule, sexe, date de naissance,
                  identifiant, rôle et état du compte
                </caption>
                <thead>
                  <tr className="border-b border-line text-[11px] tracking-wide text-ink-2 uppercase">
                    <th scope="col" className="py-2.5 font-medium">Nom et prénom</th>
                    <th scope="col" className="py-2.5 font-medium">Matricule</th>
                    <th scope="col" className="py-2.5 font-medium">Sexe</th>
                    <th scope="col" className="py-2.5 font-medium">Naissance</th>
                    <th scope="col" className="py-2.5 font-medium">Identifiant</th>
                    <th scope="col" className="py-2.5 font-medium">Rôle</th>
                    <th scope="col" className="py-2.5 font-medium">Compte</th>
                    <th scope="col" className="py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {donnees?.content.map((u) => {
                    const soiMeme = u.id === connecte.id;
                    return (
                      <tr
                        key={u.id}
                        className="border-b border-line/70 transition-colors duration-200 last:border-0 hover:bg-plane"
                      >
                        <td className="py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar nom={nomComplet(u)} taille="sm" />
                            <span className="text-[13px] font-medium text-ink">
                              {nomComplet(u)}
                              {soiMeme ? (
                                <span className="ml-2 text-[11px] font-normal text-ink-2">
                                  (vous)
                                </span>
                              ) : null}
                            </span>
                          </div>
                        </td>
                        <td className="tnum py-3 text-[13px] text-ink-2">{u.matricule}</td>
                        <td className="py-3 text-[13px] text-ink-2">
                          {libelleSexe(u.sexe)}
                        </td>
                        <td className="tnum py-3 text-[13px] text-ink-2">
                          {dateLongue(u.dateNaissance)}
                        </td>
                        <td className="py-3 font-mono text-[13px] text-ink-2">
                          {u.identifiant}
                        </td>
                        <td className="py-3 text-[13px] text-ink">{libelleRole(u)}</td>
                        <td className="py-3">
                          {u.actif ? (
                            <Badge ton="good" icone={<IconCheck className="h-3.5 w-3.5" />}>
                              Actif
                            </Badge>
                          ) : (
                            <Badge ton="neutre" icone={<IconFermer className="h-3.5 w-3.5" />}>
                              Suspendu
                            </Badge>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setEnModification(u)}
                              className="min-h-9 cursor-pointer rounded-lg px-2.5 text-xs font-medium text-brand-600 transition-colors duration-200 hover:bg-brand-50"
                            >
                              Modifier
                            </button>
                            {u.actif ? (
                              <button
                                type="button"
                                onClick={() => deconnecterPartout(u)}
                                disabled={deconnexionEnCours === u.id}
                                title="Révoque les jetons du compte sans l’empêcher de se reconnecter"
                                className="min-h-9 cursor-pointer rounded-lg px-2.5 text-xs font-medium text-ink-2 transition-colors duration-200 hover:bg-plane hover:text-ink disabled:cursor-progress"
                              >
                                Déconnecter
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => basculerStatut(u)}
                              disabled={statutEnCours === u.id}
                              className="min-h-9 cursor-pointer rounded-lg px-2.5 text-xs font-medium text-ink-2 transition-colors duration-200 hover:bg-plane hover:text-ink disabled:cursor-progress"
                            >
                              {u.actif ? "Désactiver" : "Réactiver"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {donnees && donnees.page.totalPages > 1 ? (
            <Pagination
              page={donnees.page.number}
              total={donnees.page.totalPages}
              onChanger={setPage}
            />
          ) : null}
        </>
      )}

      <p className="mt-3 text-xs text-ink-2">
        Le mot de passe n’est jamais affiché ni renvoyé par l’API : il est stocké
        haché (BCrypt). Chacun change le sien depuis ses{" "}
        <a
          href="/dashboard/parametres"
          className="underline underline-offset-2 hover:text-ink"
        >
          paramètres
        </a>
. Un compte ne se supprime pas — les ventes et livraisons enregistrées
        référencent leur auteur — il se désactive. « Déconnecter » révoque ses
        sessions en cours sans lui interdire de revenir ; « Désactiver » fait les
        deux.
      </p>

      {/* Montés à l'ouverture seulement : le démontage remet les champs à blanc. */}
      {creation ? (
        <FormulaireUtilisateur
          onFermer={() => setCreation(false)}
          onEnregistre={() => setVersion((v) => v + 1)}
        />
      ) : null}

      {enModification ? (
        <FormulaireUtilisateur
          utilisateur={enModification}
          onFermer={() => setEnModification(null)}
          onEnregistre={() => setVersion((v) => v + 1)}
        />
      ) : null}
    </>
  );
}
