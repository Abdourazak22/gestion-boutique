"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Avatar } from "@/components/ui/avatar";
import { Erreur, Squelette, Vide } from "@/components/ui/etats";
import { VentesPeriode } from "@/components/charts/ventes-periode";
import { TopProduits } from "@/components/charts/top-produits";
import { SelecteurPeriode } from "@/components/tableau-de-bord/selecteur-periode";
import { IconAlerte } from "@/components/icons";
import { useSession } from "@/components/auth/session";
import { listerAchats } from "@/lib/achats";
import { listerAlertesStock } from "@/lib/produits";
import { useRequete } from "@/lib/requete";
import {
  barresDeVentes,
  chargerStatistiques,
  longueurEnJours,
  periodePredefinie,
  periodePrecedente,
  type ClePeriode,
  type Periode,
} from "@/lib/statistiques";
import {
  libelleModePaiement,
  libelleUnite,
  panierMoyen,
  tauxMarge,
  type Achat,
  type Produit,
  type Statistiques,
} from "@/lib/types";
import { dateHeure, fcfa, nombre, pourcent } from "@/lib/format";

/**
 * Tableau de bord.
 *
 * Le gérant lit les chiffres de pilotage, servis par `GET /api/statistiques` :
 * ils sont agrégés en base, donc exacts sur toute la période, et non calculés
 * sur un échantillon de pages comme avant.
 *
 * Un vendeur n'a pas accès à cette route (403) : il reçoit un écran de caisse,
 * avec ce qu'il peut effectivement lire : alertes de stock et dernières ventes.
 */
export function Synthese() {
  const { utilisateur } = useSession();
  return utilisateur.role === "GERANT" ? <SyntheseGerant /> : <SyntheseVendeur />;
}

function SyntheseGerant() {
  const [cle, setCle] = useState<ClePeriode>("mois");
  const [periode, setPeriode] = useState<Periode>(() => periodePredefinie("mois"));

  const stats = useRequete(`stats:${periode.du}:${periode.au}`, (signal) =>
    chargerStatistiques(periode, signal),
  );
  // Période de même longueur juste avant : elle donne son sens à l'évolution.
  const precedente = periodePrecedente(periode);
  const reference = useRequete(`stats:${precedente.du}:${precedente.au}`, (signal) =>
    chargerStatistiques(precedente, signal),
  );
  const alertes = useRequete("alertes-stock-bord", (signal) =>
    listerAlertesStock({ page: 0, size: 6 }, signal),
  );
  const dernieres = useRequete(`achats-bord:${periode.du}:${periode.au}`, (signal) =>
    listerAchats({ du: periode.du, au: periode.au, page: 0, size: 5 }, signal),
  );

  if (stats.erreur) {
    return (
      <>
        <SelecteurPeriode
          periode={periode}
          cleActive={cle}
          onChanger={(p, c) => {
            setPeriode(p);
            setCle(c);
          }}
        />
        <Erreur message={stats.erreur} onReessayer={stats.recharger} />
      </>
    );
  }

  const longueur = longueurEnJours(periode);

  return (
    <>
      {/* Rangée de filtres unique, au-dessus de tout ce qu'elle cadre. */}
      <SelecteurPeriode
        periode={periode}
        cleActive={cle}
        onChanger={(p, c) => {
          setPeriode(p);
          setCle(c);
        }}
      />

      {/* Au rechargement on conserve le rendu précédent atténué : pas de
          squelette qui clignote ni de saut de mise en page. */}
      <div
        className={`transition-opacity duration-200 ${
          stats.chargement && stats.donnees ? "opacity-50" : "opacity-100"
        }`}
        aria-busy={stats.chargement || undefined}
      >
        {stats.donnees ? (
          <Kpis
            stats={stats.donnees}
            reference={reference.donnees}
            longueur={longueur}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Squelette key={i} className="h-[136px]" />
            ))}
          </div>
        )}

        <div className="mt-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader
              titre="Ventes de la période"
              sousTitre={
                longueur > 62
                  ? "Montant encaissé par mois"
                  : "Montant encaissé par jour"
              }
            />
            {stats.donnees ? (
              <VentesPeriode
                barres={barresDeVentes(stats.donnees.ventesParJour, periode)}
              />
            ) : (
              <div className="px-5 pb-5">
                <Squelette className="h-[200px]" />
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              titre="Meilleures ventes"
              sousTitre="Par chiffre d’affaires sur la période"
            />
            {stats.donnees ? (
              <TopProduits produits={stats.donnees.meilleuresVentes} />
            ) : (
              <div className="px-5 pb-5">
                <Squelette className="h-[200px]" />
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[3fr_2fr]">
        <DernieresVentes
          achats={dernieres.donnees?.content ?? []}
          chargement={dernieres.chargement}
        />
        <div className="grid gap-4">
          <AlertesStock
            produits={alertes.donnees?.content ?? []}
            total={alertes.donnees?.page.totalElements ?? 0}
            chargement={alertes.chargement}
          />
          {stats.donnees ? (
            <Encaissements stats={stats.donnees} />
          ) : (
            <Squelette className="h-40" />
          )}
          {stats.donnees ? (
            <Livraisons stats={stats.donnees} />
          ) : (
            <Squelette className="h-32" />
          )}
        </div>
      </div>
    </>
  );
}

/** Évolution signée d'une mesure par rapport à la période précédente. */
function evolution(
  courant: number,
  precedent: number | undefined,
  periode: string,
): { sens: "hausse" | "baisse"; texte: string } | undefined {
  // Sans référence, ou face à un zéro, un pourcentage ne veut rien dire.
  if (precedent === undefined || precedent === 0) return undefined;
  const variation = ((courant - precedent) / precedent) * 100;
  return {
    sens: variation >= 0 ? "hausse" : "baisse",
    texte: `${variation >= 0 ? "+" : "−"}${pourcent(Math.abs(variation), 1)} vs ${periode}`,
  };
}

function Kpis({
  stats,
  reference,
  longueur,
}: {
  stats: Statistiques;
  reference: Statistiques | null;
  longueur: number;
}) {
  const nomPeriode =
    longueur === 1 ? "la veille" : `les ${nombre(longueur)} jours précédents`;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat
        accent
        libelle="Chiffre d’affaires"
        valeur={fcfa(stats.ventes.chiffreAffaires)}
        evolution={evolution(
          stats.ventes.chiffreAffaires,
          reference?.ventes.chiffreAffaires,
          nomPeriode,
        )}
        note={`${nombre(stats.ventes.nombre)} vente${stats.ventes.nombre > 1 ? "s" : ""}`}
      />
      <Stat
        libelle="Marge réalisée"
        valeur={fcfa(stats.ventes.marge)}
        evolution={evolution(stats.ventes.marge, reference?.ventes.marge, nomPeriode)}
        note={`${pourcent(tauxMarge(stats.ventes), 1)} du chiffre d’affaires`}
      />
      <Stat
        libelle="Panier moyen"
        valeur={fcfa(Math.round(panierMoyen(stats.ventes)))}
        evolution={evolution(
          panierMoyen(stats.ventes),
          reference ? panierMoyen(reference.ventes) : undefined,
          nomPeriode,
        )}
      />
      <Stat
        libelle="Valeur du stock"
        valeur={fcfa(stats.stock.valeurAchat)}
        note={`${nombre(stats.stock.references)} référence${
          stats.stock.references > 1 ? "s" : ""
        } · ${nombre(stats.stock.enAlerte)} sous le seuil`}
      />
    </div>
  );
}

/**
 * Ventilation des encaissements par moyen de règlement.
 *
 * C'est le chiffre de la clôture : il dit ce qui doit se trouver dans le
 * tiroir-caisse et ce qui est arrivé sur chaque portefeuille mobile. Une barre
 * de proportion plutôt qu'un camembert : quatre valeurs se comparent mieux en
 * longueur, et le libellé porte l'information, pas la couleur.
 */
function Encaissements({ stats }: { stats: Statistiques }) {
  const total = stats.ventes.chiffreAffaires;

  return (
    <Card>
      <CardHeader
        titre="Encaissements"
        sousTitre="Par moyen de règlement sur la période"
      />
      {stats.ventesParMode.length === 0 ? (
        <div className="px-5 pb-5">
          <Vide titre="Aucun encaissement sur la période" />
        </div>
      ) : (
        <ul className="space-y-3 px-5 pb-5">
          {stats.ventesParMode.map((m) => (
            <li key={m.mode}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] text-ink">
                  {libelleModePaiement[m.mode]}
                </span>
                <span className="tnum text-[13px] font-semibold text-ink">
                  {fcfa(m.montant)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-plane">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${total > 0 ? (m.montant / total) * 100 : 0}%` }}
                />
              </div>
              <p className="tnum mt-1 text-[11px] text-ink-2">
                {nombre(m.nombre)} vente{m.nombre > 1 ? "s" : ""}
                {total > 0 ? ` · ${pourcent((m.montant / total) * 100)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Livraisons({ stats }: { stats: Statistiques }) {
  return (
    <Card>
      <CardHeader
        titre="Livraisons grossistes"
        sousTitre="Réceptions de la période"
        action={
          <Link
            href="/dashboard/livraisons"
            className="cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-brand-600 transition-colors duration-200 hover:bg-brand-50"
          >
            Tout voir
          </Link>
        }
      />
      <dl className="grid grid-cols-2 gap-4 px-5 pb-5">
        <div>
          <dt className="text-[11px] text-ink-2">Montant payé</dt>
          <dd className="tnum mt-1 text-lg font-semibold text-ink">
            {fcfa(stats.livraisons.montantTotal)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-ink-2">Réceptions</dt>
          <dd className="tnum mt-1 text-lg font-semibold text-ink">
            {nombre(stats.livraisons.nombre)}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

function DernieresVentes({
  achats,
  chargement,
  sousTitre = "Historique des achats clients sur la période",
}: {
  achats: Achat[];
  chargement: boolean;
  sousTitre?: string;
}) {
  return (
    <Card>
      <CardHeader
        titre="Dernières ventes"
        sousTitre={sousTitre}
        action={
          <Link
            href="/dashboard/ventes"
            className="cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-brand-600 transition-colors duration-200 hover:bg-brand-50"
          >
            Historique complet
          </Link>
        }
      />
      {chargement && achats.length === 0 ? (
        <div className="space-y-2 px-5 pb-5">
          {Array.from({ length: 4 }, (_, i) => (
            <Squelette key={i} className="h-12" />
          ))}
        </div>
      ) : achats.length === 0 ? (
        <div className="px-5 pb-5">
          <Vide titre="Aucune vente à afficher" />
        </div>
      ) : (
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] tracking-wide text-ink-2 uppercase">
                <th scope="col" className="py-2 font-medium">Client</th>
                <th scope="col" className="py-2 font-medium">Articles</th>
                <th scope="col" className="py-2 font-medium">Vendeur</th>
                <th scope="col" className="py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {achats.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-line/70 transition-colors duration-200 last:border-0 hover:bg-plane"
                >
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar nom={a.nomClient ?? "Client"} taille="sm" />
                      <div>
                        <p className="text-[13px] font-medium text-ink">
                          {a.nomClient ?? "Client de passage"}
                        </p>
                        <p className="tnum text-[11px] text-ink-2">
                          {a.numero} · {dateHeure(a.dateAchat)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="tnum py-3 text-[13px] text-ink-2">
                    {a.lignes.length} produit{a.lignes.length > 1 ? "s" : ""}
                  </td>
                  <td className="py-3 text-[13px] text-ink-2">{a.vendeur}</td>
                  <td className="tnum py-3 text-right text-[13px] font-semibold text-ink">
                    {fcfa(a.montantTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function AlertesStock({
  produits,
  total,
  chargement,
}: {
  produits: Produit[];
  total: number;
  chargement: boolean;
}) {
  return (
    <Card>
      <CardHeader
        titre="Stock sous le seuil"
        sousTitre={
          total > 0
            ? `${nombre(total)} référence${total > 1 ? "s" : ""} à commander`
            : "À commander auprès des grossistes"
        }
        action={
          <Link
            href="/dashboard/produits"
            className="cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-brand-600 transition-colors duration-200 hover:bg-brand-50"
          >
            Tout voir
          </Link>
        }
      />
      {chargement && produits.length === 0 ? (
        <div className="space-y-2 px-5 pb-5">
          {Array.from({ length: 3 }, (_, i) => (
            <Squelette key={i} className="h-14" />
          ))}
        </div>
      ) : produits.length === 0 ? (
        <div className="px-5 pb-5">
          <Vide titre="Aucun produit sous le seuil" indice="Le stock est au vert." />
        </div>
      ) : (
        <ul className="space-y-2 px-5 pb-5">
          {produits.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5"
            >
              <IconAlerte className="h-4 w-4 shrink-0 text-critical" />
              <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                {p.nom}
              </p>
              <p className="tnum shrink-0 text-right">
                <span className="block text-[13px] font-semibold text-critical">
                  {nombre(p.quantiteStock)} {libelleUnite[p.unite]}
                </span>
                <span className="block text-[11px] text-ink-3">
                  seuil {p.seuilAlerte}
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * Vue d'un vendeur : la rentabilité de la boutique ne lui est pas ouverte
 * (`/api/statistiques` est réservé au gérant), on lui montre ce qui sert à son
 * poste et qu'il peut lire.
 */
function SyntheseVendeur() {
  const aujourdhui = periodePredefinie("jour");

  const alertes = useRequete("alertes-stock-vendeur", (signal) =>
    listerAlertesStock({ page: 0, size: 6 }, signal),
  );
  const dernieres = useRequete("achats-vendeur-jour", (signal) =>
    listerAchats({ du: aujourdhui.du, au: aujourdhui.au, page: 0, size: 8 }, signal),
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
      <DernieresVentes
        achats={dernieres.donnees?.content ?? []}
        chargement={dernieres.chargement}
        sousTitre="Ventes encaissées aujourd’hui"
      />
      <AlertesStock
        produits={alertes.donnees?.content ?? []}
        total={alertes.donnees?.page.totalElements ?? 0}
        chargement={alertes.chargement}
      />
    </div>
  );
}
