"use client";

import { useActionState, useState } from "react";
import { Champ, liaisonsChamp, Liste, Saisie, Zone } from "@/components/ui/champ";
import { Dialogue } from "@/components/ui/dialogue";
import { PiedFormulaire } from "@/components/ui/pied-formulaire";
import { Erreur, Squelette, Vide } from "@/components/ui/etats";
import { champsErreur } from "@/lib/api";
import { dateHeure } from "@/lib/format";
import { notifier } from "@/lib/notifier";
import { ajusterStock, listerMouvements } from "@/lib/produits";
import { useRequete } from "@/lib/requete";
import {
  libelleMotifAjustement,
  libelleTypeMouvement,
  libelleUnite,
  MOTIFS_AJUSTEMENT,
  type MotifAjustement,
  type MouvementStock,
  type Produit,
} from "@/lib/types";

/**
 * Inventaire d'un produit : comptage en rayon et correction du stock
 * (`PATCH /api/produits/{id}/ajustement`, réservé au gérant).
 *
 * On saisit ce qu'on a compté, pas l'écart. L'écart est calculé et affiché,
 * mais c'est le serveur qui le recalcule et le journalise : entre l'ouverture
 * de cette boîte et l'enregistrement, une vente peut très bien avoir eu lieu.
 */
interface EtatFormulaire {
  champs: Record<string, string>;
  valeurs: Record<string, string>;
}

const VIDE: EtatFormulaire = { champs: {}, valeurs: {} };

const texte = (donnees: FormData, cle: string): string =>
  (donnees.get(cle) as string | null)?.trim() ?? "";

export function Inventaire({
  produit,
  onFermer,
  onAjuste,
}: {
  produit: Produit;
  onFermer: () => void;
  onAjuste: () => void;
}) {
  // Pré-rempli au stock enregistré : le cas le plus fréquent est un comptage
  // qui confirme, et il ne doit alors rien y avoir à taper.
  const [comptee, setComptee] = useState(String(produit.quantiteStock));

  const saisieValide = comptee.trim() !== "" && Number.isFinite(Number(comptee));
  const ecart = saisieValide ? Number(comptee) - produit.quantiteStock : 0;

  const [etat, soumettre, enCours] = useActionState<EtatFormulaire, FormData>(
    async (_precedent, donnees) => {
      const valeurs = Object.fromEntries(
        ["quantiteComptee", "motif", "commentaire"].map((cle) => [
          cle,
          texte(donnees, cle),
        ]),
      );

      const quantiteComptee = Number(valeurs.quantiteComptee);
      const motif = (valeurs.motif || null) as MotifAjustement | null;

      // Même règle que le serveur, posée ici pour éviter un aller-retour :
      // un écart doit être justifié, un comptage conforme n'a rien à dire.
      if (quantiteComptee !== produit.quantiteStock && !motif) {
        return {
          valeurs,
          champs: { motif: "Un motif est obligatoire pour justifier un écart." },
        };
      }

      try {
        await notifier.pendant(
          ajusterStock(produit.id, {
            quantiteComptee,
            motif,
            commentaire: valeurs.commentaire || null,
          }),
          {
            attente: "Enregistrement de l’inventaire…",
            succes: (p) =>
              `« ${p.nom} » : stock établi à ${p.quantiteStock} ${libelleUnite[p.unite]}.`,
          },
        );
        onAjuste();
        onFermer();
        return VIDE;
      } catch (erreur) {
        return { valeurs, champs: champsErreur(erreur) };
      }
    },
    VIDE,
  );

  const erreur = (cle: string) => etat.champs[cle];

  return (
    <Dialogue
      ouvert
      titre={`Inventaire · ${produit.nom}`}
      description="Saisissez la quantité réellement comptée en rayon."
      onFermer={onFermer}
    >
      <form action={soumettre} className="px-5 py-5">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-plane px-4 py-3">
              <p className="text-[11px] text-ink-2">Stock enregistré</p>
              <p className="tnum mt-0.5 text-[15px] font-semibold text-ink">
                {produit.quantiteStock} {libelleUnite[produit.unite]}
              </p>
            </div>

            <Champ
              id="quantiteComptee"
              libelle="Quantité comptée"
              obligatoire
              erreur={erreur("quantiteComptee")}
            >
              <Saisie
                {...liaisonsChamp("quantiteComptee", erreur("quantiteComptee"))}
                name="quantiteComptee"
                type="number"
                required
                min={0}
                step="1"
                inputMode="numeric"
                autoFocus
                value={comptee}
                onChange={(evenement) => setComptee(evenement.target.value)}
                erreur={erreur("quantiteComptee")}
              />
            </Champ>
          </div>

          <EcartAnnonce ecart={ecart} valide={saisieValide} />

          <Champ
            id="motif"
            libelle="Motif de l’écart"
            obligatoire={ecart !== 0}
            erreur={erreur("motif")}
            indice={
              ecart === 0
                ? "Rien à justifier : aucun écart."
                : "Pour pouvoir additionner les pertes par cause."
            }
          >
            <Liste
              {...liaisonsChamp("motif", erreur("motif"))}
              name="motif"
              defaultValue=""
              erreur={erreur("motif")}
            >
              <option value="">
                {ecart === 0 ? "Aucun" : "Choisir un motif…"}
              </option>
              {MOTIFS_AJUSTEMENT.map((m) => (
                <option key={m} value={m}>
                  {libelleMotifAjustement[m]}
                </option>
              ))}
            </Liste>
          </Champ>

          <Champ
            id="commentaire"
            libelle="Commentaire"
            erreur={erreur("commentaire")}
            indice="Facultatif, 300 caractères au plus."
          >
            <Zone
              {...liaisonsChamp("commentaire", erreur("commentaire"), true)}
              name="commentaire"
              rows={2}
              maxLength={300}
              erreur={erreur("commentaire")}
            />
          </Champ>
        </div>

        <PiedFormulaire
          onFermer={onFermer}
          enCours={enCours}
          soumettre="Enregistrer l’inventaire"
        />
      </form>

      <JournalProduit produitId={produit.id} unite={produit.unite} />
    </Dialogue>
  );
}

/**
 * Annonce l'écart en clair plutôt que de laisser le gérant le calculer.
 * `role="status"` : le lecteur d'écran l'annonce sans voler le focus pendant
 * la frappe.
 */
function EcartAnnonce({ ecart, valide }: { ecart: number; valide: boolean }) {
  if (!valide) return null;

  const [classe, message] =
    ecart === 0
      ? ["border-good/40 bg-good/5 text-ink", "Le comptage confirme le stock enregistré."]
      : ecart < 0
        ? [
            "border-critical/40 bg-critical/5 text-ink",
            `Manquant de ${Math.abs(ecart)} : le stock enregistré est trop haut.`,
          ]
        : [
            "border-brand-300 bg-brand-500/5 text-ink",
            `Excédent de ${ecart} : le stock enregistré est trop bas.`,
          ];

  return (
    <p role="status" className={`rounded-lg border px-4 py-2.5 text-[13px] ${classe}`}>
      {message}
    </p>
  );
}

/** Les derniers mouvements du produit, pour situer le comptage. */
function JournalProduit({
  produitId,
  unite,
}: {
  produitId: number;
  unite: Produit["unite"];
}) {
  const { donnees, chargement, erreur, recharger } = useRequete(
    `produits/${produitId}/mouvements`,
    (signal) => listerMouvements(produitId, { page: 0, size: 8 }, signal),
  );

  return (
    <section className="border-t border-line px-5 py-5">
      <h3 className="text-[13px] font-semibold text-ink">
        Derniers mouvements de stock
      </h3>

      {chargement ? (
        <Squelette className="mt-3 h-24" />
      ) : erreur ? (
        <Erreur message="Journal indisponible." onReessayer={recharger} />
      ) : !donnees || donnees.content.length === 0 ? (
        <Vide titre="Aucun mouvement enregistré." />
      ) : (
        <ul className="mt-3 grid gap-2">
          {donnees.content.map((m) => (
            <LigneMouvement key={m.id} mouvement={m} unite={unite} />
          ))}
        </ul>
      )}
    </section>
  );
}

function LigneMouvement({
  mouvement: m,
  unite,
}: {
  mouvement: MouvementStock;
  unite: Produit["unite"];
}) {
  // Le signe est porté par le texte et non par la seule couleur : une entrée
  // et une sortie doivent se distinguer sans percevoir les couleurs.
  const signe = m.variation > 0 ? "+" : m.variation < 0 ? "−" : "=";
  const teinte =
    m.variation > 0 ? "text-good" : m.variation < 0 ? "text-critical" : "text-ink-2";

  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-line px-3 py-2">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink">
          {libelleTypeMouvement[m.type]}
          {m.motif ? ` · ${libelleMotifAjustement[m.motif]}` : ""}
          {m.reference ? ` · ${m.reference}` : ""}
        </p>
        <p className="mt-0.5 text-[11px] text-ink-2">
          {dateHeure(m.date)}
          {/* Nul pour la reprise de stock antérieure au journal. */}
          {m.auteur ? ` · ${m.auteur}` : " · reprise initiale"}
        </p>
        {m.commentaire ? (
          <p className="mt-0.5 text-[11px] text-ink-2 italic">{m.commentaire}</p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <p className={`tnum text-[13px] font-semibold ${teinte}`}>
          {signe}
          {Math.abs(m.variation)} {libelleUnite[unite]}
        </p>
        <p className="tnum mt-0.5 text-[11px] text-ink-2">
          reste {m.stockApres}
        </p>
      </div>
    </li>
  );
}
