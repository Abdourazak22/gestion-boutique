"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Erreur, PageHorsLimites, Squelette, Vide } from "@/components/ui/etats";
import { IconAlerte, IconCheck, IconRecherche } from "@/components/icons";
import { listerProduits } from "@/lib/produits";
import { useRequete } from "@/lib/requete";
import { libelleUnite, marge, type Produit } from "@/lib/types";
import { fcfa, nombre, pourcent } from "@/lib/format";

const PAR_PAGE = 12;

/**
 * Catalogue branché sur `GET /api/produits`.
 *
 * La recherche par nom est déléguée au serveur : c'est lui qui détient le
 * catalogue entier ; filtrer la page courante côté navigateur ne trouverait
 * que les produits déjà chargés.
 */
export function Catalogue({
  version = 0,
  rechercheInitiale = "",
}: {
  version?: number;
  /** Terme venu de l'URL (recherche lancée depuis la barre du haut). */
  rechercheInitiale?: string;
}) {
  const [saisie, setSaisie] = useState(rechercheInitiale);
  const [recherche, setRecherche] = useState(rechercheInitiale);
  const [page, setPage] = useState(0);

  // Laisser retomber la frappe avant d'interroger l'API : une requête par
  // caractère saturerait le serveur pour un résultat qu'on jette aussitôt.
  useEffect(() => {
    const minuteur = setTimeout(() => {
      setRecherche(saisie);
      setPage(0);
    }, 300);
    return () => clearTimeout(minuteur);
  }, [saisie]);

  const { donnees, chargement, erreur, recharger } = useRequete(
    `produits?nom=${recherche}&page=${page}&v=${version}`,
    (signal) => listerProduits({ nom: recherche, page, size: PAR_PAGE }, signal),
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface p-4">
        <div className="relative w-full sm:max-w-sm">
          <label htmlFor="recherche-produit" className="sr-only">
            Rechercher un produit par son nom
          </label>
          <IconRecherche className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            id="recherche-produit"
            type="search"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="Nom du produit…"
            className="h-10 w-full rounded-lg border border-line bg-plane pr-3 pl-9 text-sm text-ink placeholder:text-ink-3 focus:border-brand-400 focus:bg-surface"
          />
        </div>

        {donnees ? (
          <p aria-live="polite" className="text-xs text-ink-2 sm:ml-auto">
            {nombre(donnees.page.totalElements)} référence
            {donnees.page.totalElements > 1 ? "s" : ""}
            {recherche ? ` pour « ${recherche} »` : ""}
          </p>
        ) : null}
      </div>

      {erreur ? (
        <Erreur message={erreur} onReessayer={recharger} />
      ) : chargement ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i}>
              <Squelette className="h-52" />
            </li>
          ))}
        </ul>
      ) : donnees && donnees.content.length === 0 ? (
        donnees.page.totalElements > 0 ? (
          <PageHorsLimites onRetour={() => setPage(0)} />
        ) : (
          <Vide
            titre="Aucun produit trouvé"
            indice={
              recherche
                ? "Vérifiez l’orthographe ou effacez la recherche."
                : "Le catalogue est vide : ajoutez un premier produit."
            }
          />
        )
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {donnees?.content.map((p) => (
              <li key={p.id}>
                <CarteProduit produit={p} />
              </li>
            ))}
          </ul>

          {donnees && donnees.page.totalPages > 1 ? (
            <Pagination
              page={donnees.page.number}
              total={donnees.page.totalPages}
              onChanger={setPage}
            />
          ) : null}
        </>
      )}
    </>
  );
}

function CarteProduit({ produit: p }: { produit: Produit }) {
  // Le remplissage se lit par rapport à trois fois le seuil : au-delà, le
  // stock est confortable et la nuance n'apporte plus rien.
  const reference = Math.max(p.seuilAlerte * 3, 1);
  const remplissage = Math.min((p.quantiteStock / reference) * 100, 100);

  return (
    <article className="h-full rounded-card border border-line bg-surface p-5 transition-colors duration-200 hover:border-brand-300">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] leading-snug font-semibold text-ink">
            {p.nom}
          </h2>
          {p.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-ink-2">
              {p.description}
            </p>
          ) : null}
        </div>
        {p.enAlerteStock ? (
          <Badge ton="critical" icone={<IconAlerte className="h-3.5 w-3.5" />}>
            Stock bas
          </Badge>
        ) : (
          <Badge ton="good" icone={<IconCheck className="h-3.5 w-3.5" />}>
            En stock
          </Badge>
        )}
      </div>

      <dl className="tnum mt-4 grid grid-cols-3 gap-3">
        <div>
          <dt className="text-[11px] text-ink-2">Achat</dt>
          <dd className="mt-0.5 text-[13px] font-medium text-ink">
            {fcfa(p.prixAchat)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-ink-2">Vente</dt>
          <dd className="mt-0.5 text-[13px] font-semibold text-ink">
            {fcfa(p.prixVente)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-ink-2">Marge</dt>
          <dd className="mt-0.5 text-[13px] font-medium text-brand-600">
            {pourcent(marge(p))}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-[11px]">
          <span className="text-ink-2">Stock · seuil {p.seuilAlerte}</span>
          <span className="tnum font-semibold text-ink">
            {nombre(p.quantiteStock)} {libelleUnite[p.unite]}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-plane">
          <div
            className={`h-full rounded-full ${p.enAlerteStock ? "bg-critical" : "bg-brand-500"}`}
            style={{ width: `${Math.max(remplissage, 4)}%` }}
          />
        </div>
      </div>
    </article>
  );
}

export function Pagination({
  page,
  total,
  onChanger,
}: {
  page: number;
  total: number;
  onChanger: (page: number) => void;
}) {
  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex items-center justify-center gap-2"
    >
      <button
        type="button"
        onClick={() => onChanger(page - 1)}
        disabled={page === 0}
        className="min-h-11 cursor-pointer rounded-lg border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors duration-200 hover:bg-plane disabled:cursor-not-allowed disabled:text-ink-3"
      >
        Précédent
      </button>
      <span aria-current="page" className="tnum px-2 text-sm text-ink-2">
        Page {page + 1} sur {total}
      </span>
      <button
        type="button"
        onClick={() => onChanger(page + 1)}
        disabled={page >= total - 1}
        className="min-h-11 cursor-pointer rounded-lg border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors duration-200 hover:bg-plane disabled:cursor-not-allowed disabled:text-ink-3"
      >
        Suivant
      </button>
    </nav>
  );
}
