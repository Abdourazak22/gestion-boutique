"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Erreur, PageHorsLimites, Squelette, Vide } from "@/components/ui/etats";
import { Pagination } from "@/components/produits/catalogue";
import { IconFermer, IconImprimer, IconRecherche } from "@/components/icons";
import { listerAchats, ouvrirTicket } from "@/lib/achats";
import { useRequete } from "@/lib/requete";
import { notifier } from "@/lib/notifier";
import type { Achat } from "@/lib/types";
import { dateCourte, dateLongue, fcfa, heure } from "@/lib/format";
import { messageErreur } from "@/lib/api";

const PAR_PAGE = 20;

/**
 * Historique branché sur `GET /api/achats`.
 *
 * Les bornes de dates sont envoyées au serveur ; la recherche texte, elle,
 * n'existe pas côté API et ne porte donc que sur la page affichée — c'est dit
 * à l'utilisateur plutôt que laissé deviner.
 */
export function TableVentes() {
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [page, setPage] = useState(0);
  const [requete, setRequete] = useState("");
  const [selection, setSelection] = useState<number[]>([]);
  const [ouvert, setOuvert] = useState<number | null>(null);

  const { donnees, chargement, erreur, recharger } = useRequete(
    `achats?du=${du}&au=${au}&page=${page}`,
    (signal) =>
      listerAchats(
        { du: du || undefined, au: au || undefined, page, size: PAR_PAGE },
        signal,
      ),
  );

  const achats = donnees?.content ?? [];
  const terme = requete.trim().toLowerCase();
  const visibles = terme
    ? achats.filter(
        (a) =>
          a.numero.toLowerCase().includes(terme) ||
          (a.nomClient ?? "").toLowerCase().includes(terme) ||
          a.vendeur.toLowerCase().includes(terme) ||
          a.lignes.some((l) => l.nomProduit.toLowerCase().includes(terme)),
      )
    : achats;

  const detail = achats.find((a) => a.id === ouvert) ?? null;

  const basculer = (id: number) =>
    setSelection((courant) =>
      courant.includes(id) ? courant.filter((x) => x !== id) : [...courant, id],
    );

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <section className="min-w-0 rounded-card border border-line bg-surface">
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <div>
            <label htmlFor="du" className="mb-1 block text-[11px] text-ink-2">
              Du
            </label>
            <input
              id="du"
              type="date"
              value={du}
              onChange={(e) => {
                setDu(e.target.value);
                setPage(0);
              }}
              className="tnum h-10 rounded-lg border border-line bg-plane px-3 text-sm text-ink focus:border-brand-400 focus:bg-surface"
            />
          </div>
          <div>
            <label htmlFor="au" className="mb-1 block text-[11px] text-ink-2">
              Au
            </label>
            <input
              id="au"
              type="date"
              value={au}
              onChange={(e) => {
                setAu(e.target.value);
                setPage(0);
              }}
              className="tnum h-10 rounded-lg border border-line bg-plane px-3 text-sm text-ink focus:border-brand-400 focus:bg-surface"
            />
          </div>
          {du || au ? (
            <button
              type="button"
              onClick={() => {
                setDu("");
                setAu("");
                setPage(0);
              }}
              className="h-10 cursor-pointer rounded-lg px-3 text-xs font-medium text-brand-600 transition-colors duration-200 hover:bg-brand-50"
            >
              Effacer les dates
            </button>
          ) : null}

          <div className="relative ml-auto w-full sm:w-64">
            <label htmlFor="recherche-ventes" className="sr-only">
              Filtrer les ventes affichées
            </label>
            <IconRecherche className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              id="recherche-ventes"
              type="search"
              value={requete}
              onChange={(e) => setRequete(e.target.value)}
              placeholder="Filtrer cette page…"
              className="h-10 w-full rounded-lg border border-line bg-plane pr-3 pl-9 text-sm text-ink placeholder:text-ink-3 focus:border-brand-400 focus:bg-surface"
            />
          </div>
        </div>

        {erreur ? (
          <div className="p-4">
            <Erreur message={erreur} onReessayer={recharger} />
          </div>
        ) : chargement ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Squelette key={i} className="h-12" />
            ))}
          </div>
        ) : achats.length === 0 ? (
          <div className="p-4">
            {donnees && donnees.page.totalElements > 0 ? (
              <PageHorsLimites onRetour={() => setPage(0)} />
            ) : (
              <Vide
                titre="Aucune vente enregistrée"
                indice={
                  du || au
                    ? "Aucune vente sur cette plage de dates."
                    : "Les ventes apparaîtront ici dès le premier encaissement."
                }
              />
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <caption className="sr-only">
                  Historique des achats clients, {visibles.length} ligne
                  {visibles.length > 1 ? "s" : ""} affichée
                  {visibles.length > 1 ? "s" : ""}
                </caption>
                <thead>
                  <tr className="border-b border-line text-[11px] tracking-wide text-ink-2 uppercase">
                    <th scope="col" className="w-10 py-2.5 pl-4" />
                    <th scope="col" className="py-2.5 font-medium">Vente</th>
                    <th scope="col" className="py-2.5 font-medium">Client</th>
                    <th scope="col" className="py-2.5 font-medium">Vendeur</th>
                    <th scope="col" className="py-2.5 font-medium">Articles</th>
                    <th scope="col" className="py-2.5 text-right font-medium">Total</th>
                    <th scope="col" className="py-2.5 pr-4 text-right font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((a) => (
                    <tr
                      key={a.id}
                      onClick={() => setOuvert(a.id)}
                      className={`cursor-pointer border-b border-line/70 transition-colors duration-200 last:border-0 ${
                        a.id === ouvert ? "bg-brand-50" : "hover:bg-plane"
                      }`}
                    >
                      <td className="py-3 pl-4">
                        <input
                          type="checkbox"
                          checked={selection.includes(a.id)}
                          onChange={() => basculer(a.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Sélectionner la vente ${a.numero}`}
                          className="h-4 w-4 cursor-pointer accent-brand-500"
                        />
                      </td>
                      <td className="tnum py-3 font-medium text-ink">{a.numero}</td>
                      <td className="py-3">
                        {a.nomClient ? (
                          <div className="flex items-center gap-2.5">
                            <Avatar nom={a.nomClient} taille="sm" />
                            <span className="text-[13px] text-ink">
                              {a.nomClient}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[13px] text-ink-3">
                            Client de passage
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-[13px] text-ink-2">{a.vendeur}</td>
                      <td className="tnum py-3 text-[13px] text-ink-2">
                        {a.lignes.length}
                      </td>
                      <td className="tnum py-3 text-right text-[13px] font-semibold text-ink">
                        {fcfa(a.montantTotal)}
                      </td>
                      <td className="tnum py-3 pr-4 text-right text-[13px] text-ink-2">
                        {dateCourte(a.dateAchat)}
                      </td>
                    </tr>
                  ))}
                  {visibles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <p className="text-sm font-medium text-ink">
                          Aucune vente ne correspond
                        </p>
                        <p className="mt-1 text-xs text-ink-2">
                          Le filtre ne porte que sur les {achats.length} ventes
                          de cette page.
                        </p>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {selection.length > 0 ? (
              <div className="sticky bottom-4 mx-4 mt-4 mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-shell px-3 py-2.5 text-white">
                <button
                  type="button"
                  onClick={() => setSelection([])}
                  aria-label="Vider la sélection"
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-white/10 transition-colors duration-200 hover:bg-white/20"
                >
                  <IconFermer className="h-4 w-4" />
                </button>
                <span className="tnum px-1 text-xs">
                  {selection.length} sélectionnée{selection.length > 1 ? "s" : ""}
                </span>
              </div>
            ) : null}

            {donnees && donnees.page.totalPages > 1 ? (
              <div className="pb-4">
                <Pagination
                  page={donnees.page.number}
                  total={donnees.page.totalPages}
                  onChanger={setPage}
                />
              </div>
            ) : null}
          </>
        )}
      </section>

      {detail ? <Ticket achat={detail} onFermer={() => setOuvert(null)} /> : null}
    </div>
  );
}

/** Ticket de caisse — exigence « imprimer le ticket de caisse ». */
function Ticket({ achat, onFermer }: { achat: Achat; onFermer: () => void }) {
  return (
    <aside className="h-fit rounded-card border border-line bg-surface xl:sticky xl:top-6">
      <header className="flex items-center justify-between gap-3 rounded-t-card bg-shell px-4 py-3 text-white">
        <p className="tnum text-sm font-semibold">Ticket {achat.numero}</p>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer le ticket"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors duration-200 hover:bg-white/10"
        >
          <IconFermer className="h-4 w-4" />
        </button>
      </header>

      <div className="space-y-1 border-b border-line px-4 py-4">
        <div className="flex items-center gap-2.5">
          <Avatar nom={achat.nomClient ?? "Client"} taille="sm" />
          <div>
            <p className="text-[13px] font-medium text-ink">
              {achat.nomClient ?? "Client de passage"}
            </p>
            <p className="text-[11px] text-ink-2">
              {dateLongue(achat.dateAchat)} à {heure(achat.dateAchat)}
            </p>
          </div>
        </div>
        <dl className="tnum grid grid-cols-2 gap-x-3 gap-y-1 pt-3 text-[11px]">
          <dt className="text-ink-2">Vendeur</dt>
          <dd className="text-right text-ink">{achat.vendeur}</dd>
          {achat.telephoneClient ? (
            <>
              <dt className="text-ink-2">Téléphone</dt>
              <dd className="text-right text-ink">{achat.telephoneClient}</dd>
            </>
          ) : null}
        </dl>
      </div>

      <div className="px-4 py-4">
        <p className="mb-3 text-[11px] font-semibold tracking-wide text-ink-2 uppercase">
          Articles ({achat.lignes.length})
        </p>
        <ul className="space-y-3">
          {achat.lignes.map((l) => (
            <li key={l.produitId} className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-plane text-[11px] font-semibold text-ink-2">
                ×{l.quantite}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug text-ink">{l.nomProduit}</p>
                <p className="tnum mt-0.5 text-[11px] text-ink-2">
                  {fcfa(l.prixUnitaire)} l’unité
                </p>
              </div>
              <p className="tnum shrink-0 text-[13px] font-medium text-ink">
                {fcfa(l.montantLigne)}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3">
          <span className="text-[13px] font-medium text-ink-2">Total</span>
          <span className="tnum text-lg font-semibold text-ink">
            {fcfa(achat.montantTotal)}
          </span>
        </div>
      </div>

      <div className="border-t border-line p-3">
        <BoutonTicket achat={achat} />
      </div>
    </aside>
  );
}

/**
 * Ouvre le ticket PDF produit par `GET /api/achats/{id}/ticket` (gabarit 58 mm),
 * servi en `inline` : le navigateur l'affiche dans sa visionneuse, prêt à
 * imprimer. Remplace un `window.print()` qui imprimait la page entière.
 */
function BoutonTicket({ achat }: { achat: Achat }) {
  const [enCours, setEnCours] = useState(false);

  async function ouvrir() {
    setEnCours(true);
    try {
      const fenetre = await ouvrirTicket(achat.id);
      if (!fenetre) {
        notifier.erreur(
          "Le navigateur a bloqué l’ouverture du ticket. Autorisez les fenêtres surgissantes pour ce site.",
        );
      }
    } catch (erreur) {
      notifier.erreur(messageErreur(erreur));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <button
      type="button"
      onClick={ouvrir}
      disabled={enCours}
      className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-500 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-600 disabled:cursor-progress disabled:bg-brand-500/60"
    >
      <IconImprimer className="h-4 w-4" />
      {enCours ? "Préparation du ticket…" : "Imprimer le ticket"}
    </button>
  );
}
