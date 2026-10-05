"use client";

import { useActionState } from "react";
import { Champ, liaisonsChamp, Liste, Saisie, Zone } from "@/components/ui/champ";
import { Dialogue } from "@/components/ui/dialogue";
import { BoutonSecondaire } from "@/components/ui/entete-page";
import { champsErreur } from "@/lib/api";
import { notifier } from "@/lib/notifier";
import { creerProduit, type ProduitRequete } from "@/lib/produits";
import { libelleUnite, UNITES, type UniteMesure } from "@/lib/types";

/**
 * Création d'un produit (`POST /api/produits`, réservé au gérant).
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

const texte = (donnees: FormData, cle: string): string =>
  (donnees.get(cle) as string | null)?.trim() ?? "";

/** Ce composant n'est monté que lorsque la boîte doit être visible. */
export function FormulaireProduit({
  onFermer,
  onCree,
}: {
  onFermer: () => void;
  onCree: () => void;
}) {
  // Action côté client et non Server Action : le jeton d'authentification vit
  // dans le navigateur, le serveur Next ne peut pas appeler l'API à sa place.
  const [etat, soumettre, enCours] = useActionState<EtatFormulaire, FormData>(
    async (_precedent, donnees) => {
      const valeurs = Object.fromEntries(
        ["nom", "description", "prixAchat", "prixVente", "unite", "quantiteStock", "seuilAlerte"]
          .map((cle) => [cle, texte(donnees, cle)]),
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

      const requete: ProduitRequete = {
        nom: valeurs.nom!,
        description: valeurs.description || null,
        prixAchat,
        prixVente,
        unite: valeurs.unite as UniteMesure,
        quantiteStock: Number(valeurs.quantiteStock),
        seuilAlerte: Number(valeurs.seuilAlerte),
      };

      try {
        await notifier.pendant(creerProduit(requete), {
          attente: "Enregistrement du produit…",
          succes: `« ${requete.nom} » ajouté au catalogue.`,
        });
        onCree();
        onFermer();
        return { champs: {}, valeurs: {} };
      } catch (erreur) {
        // 400 : le détail par champ est plus utile que le message global, et le
        // toast de `pendant()` a déjà annoncé l'échec.
        return { valeurs, champs: champsErreur(erreur) };
      }
    },
    VIDE,
  );

  const valeur = (cle: string) => etat.valeurs[cle] ?? "";
  const erreur = (cle: string) => etat.champs[cle];

  return (
    <Dialogue
      ouvert
      titre="Ajouter un produit"
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

          <div className="grid gap-4 sm:grid-cols-3">
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
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-line pt-4">
          <BoutonSecondaire onClick={onFermer} disabled={enCours}>
            Annuler
          </BoutonSecondaire>
          <button
            type="submit"
            disabled={enCours}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-600 disabled:cursor-progress disabled:bg-brand-500/60"
          >
            {enCours ? "Enregistrement…" : "Ajouter le produit"}
          </button>
        </div>
      </form>
    </Dialogue>
  );
}
