"use client";

import { useActionState, useState } from "react";
import { Champ, liaisonsChamp, Liste, Zone } from "@/components/ui/champ";
import { Dialogue } from "@/components/ui/dialogue";
import { BoutonSecondaire } from "@/components/ui/entete-page";
import { champsErreur } from "@/lib/api";
import { annulerAchat } from "@/lib/achats";
import { notifier } from "@/lib/notifier";
import {
  libelleMotifAnnulation,
  MOTIFS_ANNULATION,
  retourEnStockParDefaut,
  type Achat,
  type MotifAnnulation,
} from "@/lib/types";
import { fcfa } from "@/lib/format";

/**
 * Annulation d'une vente.
 *
 * La vente n'est pas supprimée : son ticket a été remis au client et son numéro
 * ne doit jamais être réattribué. Elle quitte en revanche le chiffre d'affaires
 * et la marge.
 *
 * Ce composant n'est monté que lorsque la boîte doit être visible : le
 * démontage garantit un formulaire vierge à chaque réouverture.
 */
export function DialogueAnnulation({
  achat,
  onFermer,
  onAnnule,
}: {
  achat: Achat;
  onFermer: () => void;
  onAnnule: () => void;
}) {
  const [motif, setMotif] = useState<MotifAnnulation>("ERREUR_SAISIE");
  // Suggéré par le motif, mais laissé à la main du gérant : la réalité ne suit
  // pas toujours la règle.
  const [retourEnStock, setRetourEnStock] = useState(true);

  function changerMotif(nouveau: MotifAnnulation) {
    setMotif(nouveau);
    setRetourEnStock(retourEnStockParDefaut(nouveau));
  }

  const [etat, soumettre, enCours] = useActionState<Record<string, string>, FormData>(
    async (_precedent, donnees) => {
      const commentaire = (donnees.get("commentaire") as string | null)?.trim();

      try {
        await notifier.pendant(
          annulerAchat(achat.id, {
            motif,
            commentaire: commentaire || undefined,
            retourEnStock,
          }),
          {
            attente: "Annulation de la vente…",
            succes: (maj) => `Vente ${maj.numero} annulée.`,
          },
        );
        onAnnule();
        onFermer();
        return {};
      } catch (erreur) {
        return champsErreur(erreur);
      }
    },
    {},
  );

  return (
    <Dialogue
      ouvert
      titre={`Annuler la vente ${achat.numero}`}
      description={`${fcfa(achat.montantTotal)} encaissés le ${achat.dateAchat.slice(0, 10)}. La vente restera dans l’historique, marquée annulée.`}
      onFermer={onFermer}
    >
      <form action={soumettre} className="px-5 py-5">
        <div className="grid gap-4">
          <Champ id="motif" libelle="Motif" obligatoire erreur={etat.motif}>
            <Liste
              {...liaisonsChamp("motif", etat.motif)}
              value={motif}
              onChange={(e) => changerMotif(e.target.value as MotifAnnulation)}
              erreur={etat.motif}
            >
              {MOTIFS_ANNULATION.map((m) => (
                <option key={m} value={m}>
                  {libelleMotifAnnulation[m]}
                </option>
              ))}
            </Liste>
          </Champ>

          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium text-ink">
              La marchandise retourne-t-elle en rayon ?
              <span className="ml-1 text-critical" aria-hidden="true">*</span>
            </legend>
            <label
              htmlFor="retourEnStock"
              className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[13px] text-ink-2"
            >
              <input
                id="retourEnStock"
                type="checkbox"
                checked={retourEnStock}
                onChange={(e) => setRetourEnStock(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded accent-brand-500"
              />
              Oui, remettre {achat.lignes.length} article
              {achat.lignes.length > 1 ? "s" : ""} en stock
            </label>
            <p className="mt-1.5 text-xs text-ink-2">
              {retourEnStock
                ? "Le stock sera recrédité des quantités vendues."
                : "Le stock restera inchangé : la marchandise est perdue."}
            </p>
          </fieldset>

          <Champ
            id="commentaire"
            libelle="Commentaire"
            erreur={etat.commentaire}
            indice="Facultatif, 300 caractères au plus."
          >
            <Zone
              {...liaisonsChamp("commentaire", etat.commentaire, true)}
              name="commentaire"
              rows={2}
              maxLength={300}
              erreur={etat.commentaire}
            />
          </Champ>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-line pt-4">
          <BoutonSecondaire onClick={onFermer} disabled={enCours}>
            Renoncer
          </BoutonSecondaire>
          <button
            type="submit"
            disabled={enCours}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-critical px-4 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:cursor-progress disabled:opacity-60"
          >
            {enCours ? "Annulation…" : "Annuler la vente"}
          </button>
        </div>
      </form>
    </Dialogue>
  );
}
