"use client";

import { useActionState, useState } from "react";
import { Champ, liaisonsChamp, Liste, Saisie, Zone } from "@/components/ui/champ";
import { Dialogue } from "@/components/ui/dialogue";
import { BoutonSecondaire } from "@/components/ui/entete-page";
import { PiedFormulaire } from "@/components/ui/pied-formulaire";
import { champsErreur } from "@/lib/api";
import { notifier } from "@/lib/notifier";
import {
  creerProduit,
  modifierProduit,
  supprimerProduit,
  type ProduitRequete,
} from "@/lib/produits";
import {
  libelleUnite,
  UNITES,
  type Produit,
  type UniteMesure,
} from "@/lib/types";

/**
 * Création (`POST /api/produits`) et modification (`PUT /api/produits/{id}`)
 * d'un produit, réservées au gérant.
 *
 * Un seul composant pour les deux : six des sept champs sont communs, avec les
 * mêmes contraintes et les mêmes indices. Deux formulaires jumeaux auraient
 * divergé au premier changement de règle.
 *
 * La seule différence de fond est le stock. Il se saisit à la création, où il
 * devient le premier mouvement du journal, et disparaît de la modification :
 * le serveur l'y refuse en 400, parce qu'écrire un stock en valeur absolue
 * effaçait les ventes enregistrées depuis l'ouverture du formulaire.
 *
 * Les contraintes reproduites ici viennent une à une de `ProduitRequest` et de
 * `ProduitService` : elles évitent un aller-retour pour une faute évidente,
 * mais le serveur reste seul juge : un 400 renvoie sa carte `champs`, affichée
 * sous les champs concernés.
 */

interface EtatFormulaire {
  champs: Record<string, string>;
  /** Valeurs ressaisies pour que l'utilisateur ne reperde pas son travail. */
  valeurs: Record<string, string>;
}

const VIDE: EtatFormulaire = { champs: {}, valeurs: {} };

const COMMUNS = ["nom", "description", "prixAchat", "prixVente", "unite", "seuilAlerte"];

const texte = (donnees: FormData, cle: string): string =>
  (donnees.get(cle) as string | null)?.trim() ?? "";

/** Ce composant n'est monté que lorsque la boîte doit être visible. */
export function FormulaireProduit({
  produit,
  onFermer,
  onEnregistre,
}: {
  /** Absent : création. Présent : modification de ce produit. */
  produit?: Produit;
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const modification = produit !== undefined;
  // Confirmation en deux temps plutôt qu'une seconde boîte imbriquée : les
  // modales emboîtées se partagent mal le focus, et l'avertissement a besoin
  // de place pour être lu.
  const [suppressionDemandee, setSuppressionDemandee] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  // Valeurs de départ en modification. Elles ne servent qu'au premier rendu :
  // après une soumission refusée, `etat.valeurs` porte ce que l'utilisateur
  // avait tapé et doit primer.
  const initiales: Record<string, string> = produit
    ? {
        nom: produit.nom,
        description: produit.description ?? "",
        prixAchat: String(produit.prixAchat),
        prixVente: String(produit.prixVente),
        unite: produit.unite,
        seuilAlerte: String(produit.seuilAlerte),
      }
    : {};

  // Action côté client et non Server Action : le jeton d'authentification vit
  // dans le navigateur, le serveur Next ne peut pas appeler l'API à sa place.
  const [etat, soumettre, enCours] = useActionState<EtatFormulaire, FormData>(
    async (_precedent, donnees) => {
      const cles = modification ? COMMUNS : [...COMMUNS, "quantiteStock"];
      const valeurs = Object.fromEntries(
        cles.map((cle) => [cle, texte(donnees, cle)]),
      );

      const prixAchat = Number(valeurs.prixAchat);
      const prixVente = Number(valeurs.prixVente);

      // Règle de `ProduitService.verifierCoherencePrix` : inutile d'aller
      // chercher un 409 pour une comparaison qu'on peut faire ici.
      if (prixVente < prixAchat) {
        return {
          valeurs,
          champs: {
            prixVente: "Le prix de vente ne peut être inférieur au prix d’achat.",
          },
        };
      }

      const communs = {
        nom: valeurs.nom!,
        description: valeurs.description || null,
        prixAchat,
        prixVente,
        unite: valeurs.unite as UniteMesure,
        seuilAlerte: Number(valeurs.seuilAlerte),
      };

      try {
        if (produit) {
          await notifier.pendant(modifierProduit(produit.id, communs), {
            attente: "Enregistrement des modifications…",
            succes: `« ${communs.nom} » mis à jour.`,
          });
        } else {
          const requete: ProduitRequete = {
            ...communs,
            quantiteStock: Number(valeurs.quantiteStock),
          };
          await notifier.pendant(creerProduit(requete), {
            attente: "Enregistrement du produit…",
            succes: `« ${requete.nom} » ajouté au catalogue.`,
          });
        }
        onEnregistre();
        onFermer();
        return VIDE;
      } catch (erreur) {
        // 400 : le détail par champ est plus utile que le message global, et le
        // toast de `pendant()` a déjà annoncé l'échec.
        return { valeurs, champs: champsErreur(erreur) };
      }
    },
    VIDE,
  );

  async function supprimer() {
    if (!produit) return;
    setSuppressionEnCours(true);
    try {
      await notifier.pendant(supprimerProduit(produit.id), {
        attente: "Retrait du catalogue…",
        succes: `« ${produit.nom} » retiré du catalogue.`,
      });
      onEnregistre();
      onFermer();
    } catch {
      // Le toast de `pendant()` a déjà annoncé l'échec : on rend la main pour
      // laisser réessayer ou renoncer.
      setSuppressionEnCours(false);
      setSuppressionDemandee(false);
    }
  }

  const valeur = (cle: string) => etat.valeurs[cle] ?? initiales[cle] ?? "";
  const erreur = (cle: string) => etat.champs[cle];

  return (
    <Dialogue
      ouvert
      titre={modification ? `Modifier · ${produit.nom}` : "Ajouter un produit"}
      description="Les champs marqués d’une étoile sont obligatoires."
      onFermer={onFermer}
    >
      <form action={soumettre} className="px-5 py-5">
        <div className="grid gap-4">
          <Champ id="nom" libelle="Nom du produit" obligatoire erreur={erreur("nom")}>
            <Saisie
              {...liaisonsChamp("nom", erreur("nom"))}
              name="nom"
              required
              maxLength={120}
              autoFocus
              defaultValue={valeur("nom")}
              placeholder="Riz parfumé 25 kg"
              erreur={erreur("nom")}
            />
          </Champ>

          <Champ
            id="description"
            libelle="Description"
            erreur={erreur("description")}
            indice="Facultative, 500 caractères au plus."
          >
            <Zone
              {...liaisonsChamp("description", erreur("description"), true)}
              name="description"
              rows={2}
              maxLength={500}
              defaultValue={valeur("description")}
              erreur={erreur("description")}
            />
          </Champ>

          <div className="grid gap-4 sm:grid-cols-2">
            <Champ
              id="prixAchat"
              libelle="Prix d’achat"
              obligatoire
              erreur={erreur("prixAchat")}
              indice="En FCFA, deux décimales au plus."
            >
              <Saisie
                {...liaisonsChamp("prixAchat", erreur("prixAchat"), true)}
                name="prixAchat"
                type="number"
                required
                min={0}
                step="0.01"
                inputMode="decimal"
                defaultValue={valeur("prixAchat")}
                erreur={erreur("prixAchat")}
              />
            </Champ>

            <Champ
              id="prixVente"
              libelle="Prix de vente"
              obligatoire
              erreur={erreur("prixVente")}
              indice="Doit être au moins égal au prix d’achat."
            >
              <Saisie
                {...liaisonsChamp("prixVente", erreur("prixVente"), true)}
                name="prixVente"
                type="number"
                required
                min={0}
                step="0.01"
                inputMode="decimal"
                defaultValue={valeur("prixVente")}
                erreur={erreur("prixVente")}
              />
            </Champ>
          </div>

          <div
            className={`grid gap-4 ${modification ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}
          >
            <Champ id="unite" libelle="Unité" obligatoire erreur={erreur("unite")}>
              <Liste
                {...liaisonsChamp("unite", erreur("unite"))}
                name="unite"
                required
                defaultValue={valeur("unite") || "PIECE"}
                erreur={erreur("unite")}
              >
                {UNITES.map((u) => (
                  <option key={u} value={u}>
                    {libelleUnite[u]}
                  </option>
                ))}
              </Liste>
            </Champ>

            {/* Absent en modification : le stock ne se corrige que par un
                ajustement d'inventaire, qui en garde la trace et le motif. */}
            {modification ? null : (
              <Champ
                id="quantiteStock"
                libelle="Stock initial"
                obligatoire
                erreur={erreur("quantiteStock")}
              >
                <Saisie
                  {...liaisonsChamp("quantiteStock", erreur("quantiteStock"))}
                  name="quantiteStock"
                  type="number"
                  required
                  min={0}
                  step="1"
                  inputMode="numeric"
                  defaultValue={valeur("quantiteStock") || "0"}
                  erreur={erreur("quantiteStock")}
                />
              </Champ>
            )}

            <Champ
              id="seuilAlerte"
              libelle="Seuil d’alerte"
              obligatoire
              erreur={erreur("seuilAlerte")}
              indice="Stock bas en dessous."
            >
              <Saisie
                {...liaisonsChamp("seuilAlerte", erreur("seuilAlerte"), true)}
                name="seuilAlerte"
                type="number"
                required
                min={0}
                step="1"
                inputMode="numeric"
                defaultValue={valeur("seuilAlerte") || "0"}
                erreur={erreur("seuilAlerte")}
              />
            </Champ>
          </div>

          {modification ? (
            <p className="rounded-lg border border-line bg-plane px-4 py-2.5 text-[13px] text-ink-2">
              Stock actuel : {produit.quantiteStock} {libelleUnite[produit.unite]}.
              Il ne se modifie pas ici, mais par un inventaire.
            </p>
          ) : null}
        </div>

        {suppressionDemandee && produit ? (
          <div className="mt-6 border-t border-line pt-4">
            <div className="rounded-lg border border-critical/40 bg-critical/5 px-4 py-3">
              <p className="text-[13px] font-semibold text-ink">
                Retirer « {produit.nom} » du catalogue ?
              </p>
              <ul className="mt-2 grid gap-1 text-[13px] text-ink-2">
                <li>
                  Il reste rattaché aux ventes et livraisons déjà enregistrées,
                  et son journal de stock est conservé.
                </li>
                {/* Conséquence chiffrée plutôt qu'un avertissement vague : la
                    valorisation du stock ne compte que les produits actifs. */}
                {produit.quantiteStock > 0 ? (
                  <li>
                    Ses {produit.quantiteStock} {libelleUnite[produit.unite]} en
                    stock sortiront de la valorisation du tableau de bord.
                  </li>
                ) : null}
                <li>
                  Recréer un produit du même nom le remettra au catalogue.
                </li>
              </ul>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <BoutonSecondaire
                onClick={() => setSuppressionDemandee(false)}
                disabled={suppressionEnCours}
              >
                Renoncer
              </BoutonSecondaire>
              <button
                type="button"
                onClick={supprimer}
                disabled={suppressionEnCours}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-critical px-4 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:cursor-progress disabled:opacity-60"
              >
                {suppressionEnCours ? "Retrait…" : "Oui, retirer du catalogue"}
              </button>
            </div>
          </div>
        ) : (
          <PiedFormulaire
            onFermer={onFermer}
            enCours={enCours}
            soumettre={
              modification ? "Enregistrer les modifications" : "Ajouter le produit"
            }
            aGauche={
              modification ? (
                <button
                  type="button"
                  onClick={() => setSuppressionDemandee(true)}
                  className="min-h-11 cursor-pointer rounded-lg px-3 text-[13px] font-medium text-critical transition-colors duration-200 hover:bg-critical/10"
                >
                  Supprimer du catalogue
                </button>
              ) : undefined
            }
          />
        )}
      </form>
    </Dialogue>
  );
}
