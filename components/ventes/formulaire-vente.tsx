"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { Champ, liaisonsChamp, Liste, Saisie } from "@/components/ui/champ";
import { Erreur, Squelette, Vide } from "@/components/ui/etats";
import { Badge } from "@/components/ui/badge";
import { IconAlerte, IconFermer, IconPlus, IconRecherche } from "@/components/icons";
import { enregistrerAchat, type AchatRequete } from "@/lib/achats";
import { listerProduits, produitParId } from "@/lib/produits";
import { useRequete } from "@/lib/requete";
import { notifier } from "@/lib/notifier";
import {
  libelleModePaiement,
  libelleUnite,
  MODES_PAIEMENT,
  type ModePaiement,
  type Produit,
} from "@/lib/types";
import { statutHttp } from "@/lib/api";
import { fcfa, nombre } from "@/lib/format";

/** Une ligne du panier. Le prix est figé à l'affichage, le serveur le refixe. */
interface LigneVente {
  produit: Produit;
  quantite: number;
}

const PAR_PAGE = 8;

/**
 * Caisse : composer un panier puis `POST /api/achats`.
 *
 * Trois règles de `AchatService` sont reprises ici pour éviter un 409 prévisible
 * : un même produit ne peut figurer deux fois (l'ajouter à nouveau incrémente
 * sa quantité), la quantité est au minimum de 1, et elle ne peut dépasser le
 * stock connu. Le serveur reste l'autorité : il décrémente sous transaction et
 * annule la vente entière si un stock manque.
 */
export function FormulaireVente() {
  const router = useRouter();
  const [saisie, setSaisie] = useState("");
  const [recherche, setRecherche] = useState("");
  const [lignes, setLignes] = useState<LigneVente[]>([]);
  const [nomClient, setNomClient] = useState("");
  const [telephoneClient, setTelephoneClient] = useState("");
  // Espèces par défaut : c'est le règlement majoritaire au comptoir.
  const [modePaiement, setModePaiement] = useState<ModePaiement>("ESPECES");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    const minuteur = setTimeout(() => setRecherche(saisie), 300);
    return () => clearTimeout(minuteur);
  }, [saisie]);

  const catalogue = useRequete(`caisse-produits?nom=${recherche}`, (signal) =>
    listerProduits({ nom: recherche, page: 0, size: PAR_PAGE }, signal),
  );

  const total = useMemo(
    () => lignes.reduce((somme, l) => somme + l.produit.prixVente * l.quantite, 0),
    [lignes],
  );

  function ajouter(produit: Produit) {
    setLignes((courantes) => {
      const existante = courantes.find((l) => l.produit.id === produit.id);
      if (!existante) return [...courantes, { produit, quantite: 1 }];
      // Regroupement plutôt que doublon : c'est exactement ce que le serveur
      // exige (« regroupez-le en une seule ligne »).
      return courantes.map((l) =>
        l.produit.id === produit.id
          ? { ...l, quantite: Math.min(l.quantite + 1, produit.quantiteStock) }
          : l,
      );
    });
  }

  function changerQuantite(produitId: number, quantite: number) {
    setLignes((courantes) =>
      courantes.map((l) =>
        l.produit.id === produitId
          ? {
              ...l,
              quantite: Math.max(1, Math.min(quantite, l.produit.quantiteStock)),
            }
          : l,
      ),
    );
  }

  const retirer = (produitId: number) =>
    setLignes((courantes) => courantes.filter((l) => l.produit.id !== produitId));

  /**
   * Relit en base chaque produit du panier.
   *
   * Sans cela, après un refus les lignes gardent le stock lu au moment de
   * l'ajout : le plafond de quantité et le « / N en stock » affichés seraient
   * faux, et l'utilisateur rejouerait la même vente vouée au même échec. Une
   * ligne dont le produit a disparu du catalogue est retirée, la garder
   * n'offrirait qu'un 404 de plus.
   */
  async function resynchroniserLePanier() {
    const aJour = await Promise.all(
      lignes.map(async (l) => {
        try {
          return { ...l, produit: await produitParId(l.produit.id) };
        } catch (erreur) {
          return statutHttp(erreur) === 404 ? null : l;
        }
      }),
    );

    const retenues = aJour.filter((l): l is LigneVente => l !== null);
    if (retenues.length < lignes.length) {
      notifier.erreur(
        "Un produit du panier n’est plus au catalogue : sa ligne a été retirée.",
      );
    }
    // La quantité peut désormais dépasser le stock relu : on la ramène dedans.
    setLignes(
      retenues.map((l) => ({
        ...l,
        quantite: Math.max(1, Math.min(l.quantite, l.produit.quantiteStock)),
      })),
    );
  }

  async function encaisser() {
    setEnCours(true);
    const requete: AchatRequete = {
      nomClient: nomClient.trim() || undefined,
      telephoneClient: telephoneClient.trim() || undefined,
      modePaiement,
      lignes: lignes.map((l) => ({
        produitId: l.produit.id,
        quantite: l.quantite,
      })),
    };

    try {
      await notifier.pendant(enregistrerAchat(requete), {
        attente: "Enregistrement de la vente…",
        // Le numéro n'existe qu'une fois le ticket créé par le serveur.
        succes: (achat) => `Ticket ${achat.numero} enregistré.`,
      });
      // Le toast survit à la navigation (le Toaster est monté à la racine), et
      // l'historique recharge ses données : on y renvoie plutôt que de garder
      // à l'écran un panier déjà encaissé.
      router.replace("/dashboard/ventes");
    } catch {
      // Stock insuffisant, produit en double, produit supprimé entre-temps : le
      // message du serveur est déjà passé par le toast. Les stocks affichés
      // sont périmés, on les resynchronise avant de laisser réessayer.
      catalogue.recharger();
      await resynchroniserLePanier();
      setEnCours(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <Card className="min-w-0">
        <CardHeader
          titre="Choisir les produits"
          sousTitre="Cliquez sur un produit pour l’ajouter au panier."
        />

        <div className="px-5">
          <div className="relative">
            <label htmlFor="recherche-caisse" className="sr-only">
              Rechercher un produit par son nom
            </label>
            <IconRecherche className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              id="recherche-caisse"
              type="search"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              autoFocus
              placeholder="Nom du produit…"
              className="h-11 w-full rounded-lg border border-line bg-plane pr-3 pl-9 text-sm text-ink placeholder:text-ink-3 focus:border-brand-400 focus:bg-surface"
            />
          </div>
        </div>

        <div className="px-5 py-4">
          {catalogue.erreur ? (
            <Erreur message={catalogue.erreur} onReessayer={catalogue.recharger} />
          ) : catalogue.chargement ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Squelette key={i} className="h-16" />
              ))}
            </div>
          ) : catalogue.donnees?.content.length === 0 ? (
            <Vide
              titre="Aucun produit trouvé"
              indice={
                recherche
                  ? "Vérifiez l’orthographe ou effacez la recherche."
                  : "Le catalogue est vide."
              }
            />
          ) : (
            <ul className="space-y-2">
              {catalogue.donnees?.content.map((p) => {
                const epuise = p.quantiteStock === 0;
                const dejaAuPanier = lignes.find((l) => l.produit.id === p.id);
                const auMaximum =
                  dejaAuPanier && dejaAuPanier.quantite >= p.quantiteStock;

                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => ajouter(p)}
                      disabled={epuise || Boolean(auMaximum)}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-3 text-left transition-colors duration-200 hover:border-brand-300 hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-line disabled:bg-plane disabled:hover:bg-plane"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">
                          {p.nom}
                        </p>
                        <p className="tnum mt-0.5 text-[11px] text-ink-2">
                          {fcfa(p.prixVente)} · {nombre(p.quantiteStock)}{" "}
                          {libelleUnite[p.unite]} en stock
                        </p>
                      </div>

                      {epuise ? (
                        <Badge ton="critical">Épuisé</Badge>
                      ) : auMaximum ? (
                        <Badge ton="warning">Stock atteint</Badge>
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                          <IconPlus className="h-4 w-4" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      <Panier
        lignes={lignes}
        total={total}
        nomClient={nomClient}
        telephoneClient={telephoneClient}
        modePaiement={modePaiement}
        enCours={enCours}
        onNomClient={setNomClient}
        onTelephoneClient={setTelephoneClient}
        onModePaiement={setModePaiement}
        onQuantite={changerQuantite}
        onRetirer={retirer}
        onEncaisser={encaisser}
      />
    </div>
  );
}

function Panier({
  lignes,
  total,
  nomClient,
  telephoneClient,
  modePaiement,
  enCours,
  onNomClient,
  onTelephoneClient,
  onModePaiement,
  onQuantite,
  onRetirer,
  onEncaisser,
}: {
  lignes: LigneVente[];
  total: number;
  nomClient: string;
  telephoneClient: string;
  modePaiement: ModePaiement;
  enCours: boolean;
  onNomClient: (valeur: string) => void;
  onTelephoneClient: (valeur: string) => void;
  onModePaiement: (mode: ModePaiement) => void;
  onQuantite: (produitId: number, quantite: number) => void;
  onRetirer: (produitId: number) => void;
  onEncaisser: () => void;
}) {
  return (
    <Card className="h-fit xl:sticky xl:top-6">
      <CardHeader
        titre="Panier"
        sousTitre={
          lignes.length === 0
            ? "Aucun article"
            : `${nombre(lignes.length)} article${lignes.length > 1 ? "s" : ""}`
        }
      />

      <div className="px-5">
        {lignes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-xs text-ink-2">
            Ajoutez un produit depuis la liste pour commencer la vente.
          </p>
        ) : (
          <ul className="space-y-3">
            {lignes.map((l) => (
              <li key={l.produit.id} className="flex gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink">
                    {l.produit.nom}
                  </p>
                  <p className="tnum mt-0.5 text-[11px] text-ink-2">
                    {fcfa(l.produit.prixVente)} l’unité
                  </p>

                  <div className="mt-2 flex items-center gap-2">
                    <label
                      htmlFor={`quantite-${l.produit.id}`}
                      className="text-[11px] text-ink-2"
                    >
                      Quantité
                    </label>
                    <input
                      id={`quantite-${l.produit.id}`}
                      type="number"
                      value={l.quantite}
                      min={1}
                      max={l.produit.quantiteStock}
                      step={1}
                      inputMode="numeric"
                      onChange={(e) => onQuantite(l.produit.id, Number(e.target.value))}
                      className="tnum h-9 w-20 rounded-lg border border-line bg-plane px-2 text-sm text-ink focus:border-brand-400 focus:bg-surface"
                    />
                    <span className="text-[11px] text-ink-3">
                      / {nombre(l.produit.quantiteStock)}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end justify-between">
                  <button
                    type="button"
                    onClick={() => onRetirer(l.produit.id)}
                    aria-label={`Retirer ${l.produit.nom} du panier`}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-ink-2 transition-colors duration-200 hover:bg-plane hover:text-critical"
                  >
                    <IconFermer className="h-4 w-4" />
                  </button>
                  <p className="tnum text-[13px] font-semibold text-ink">
                    {fcfa(l.produit.prixVente * l.quantite)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 grid gap-4 border-t border-line px-5 py-4">
        <Champ
          id="modePaiement"
          libelle="Moyen de paiement"
          obligatoire
          indice="Détermine ce qui sera dans la caisse ce soir."
        >
          <Liste
            {...liaisonsChamp("modePaiement", undefined, true)}
            value={modePaiement}
            onChange={(e) => onModePaiement(e.target.value as ModePaiement)}
          >
            {MODES_PAIEMENT.map((m) => (
              <option key={m} value={m}>
                {libelleModePaiement[m]}
              </option>
            ))}
          </Liste>
        </Champ>

        <Champ
          id="nomClient"
          libelle="Nom du client"
          indice="Facultatif : une vente sans nom reste valide."
        >
          <Saisie
            {...liaisonsChamp("nomClient", undefined, true)}
            value={nomClient}
            onChange={(e) => onNomClient(e.target.value)}
            maxLength={120}
            placeholder="Esther Kouadio"
          />
        </Champ>

        <Champ id="telephoneClient" libelle="Téléphone">
          <Saisie
            {...liaisonsChamp("telephoneClient")}
            value={telephoneClient}
            onChange={(e) => onTelephoneClient(e.target.value)}
            type="tel"
            maxLength={30}
            placeholder="07 00 00 00 00"
          />
        </Champ>
      </div>

      <div className="border-t border-line px-5 py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-medium text-ink-2">Total</span>
          <span className="tnum text-xl font-semibold text-ink">{fcfa(total)}</span>
        </div>

        <button
          type="button"
          onClick={onEncaisser}
          disabled={lignes.length === 0 || enCours}
          className="mt-4 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-500 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-500/50"
        >
          {enCours ? "Enregistrement…" : "Encaisser la vente"}
        </button>

        <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-ink-2">
          <IconAlerte className="mt-px h-3.5 w-3.5 shrink-0 text-ink-3" />
          Le stock est décrémenté à l’enregistrement. Si une quantité ne passe
          plus, la vente entière est annulée par le serveur.
        </p>
      </div>
    </Card>
  );
}
