"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCloche, IconRecherche } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { useSession } from "@/components/auth/session";
import { listerAlertesStock } from "@/lib/produits";
import { useRequete } from "@/lib/requete";
import { libelleRole, nomComplet } from "@/lib/types";
import { nombre } from "@/lib/format";

export function Topbar() {
  const { utilisateur } = useSession();
  const router = useRouter();
  const nom = nomComplet(utilisateur);
  const [terme, setTerme] = useState("");
  const champ = useRef<HTMLInputElement>(null);

  // La pastille de la cloche comptait « 3 alertes » en dur. Elle reflète
  // maintenant le nombre réel de produits sous leur seuil.
  const { donnees } = useRequete("alertes-stock-cloche", (signal) =>
    listerAlertesStock({ page: 0, size: 1 }, signal),
  );
  const alertes = donnees?.page.totalElements ?? 0;

  // Le raccourci était annoncé par un <kbd> sans rien derrière : il existe.
  useEffect(() => {
    const auClavier = (evenement: KeyboardEvent) => {
      if ((evenement.metaKey || evenement.ctrlKey) && evenement.key === "k") {
        evenement.preventDefault();
        champ.current?.focus();
      }
    };
    document.addEventListener("keydown", auClavier);
    return () => document.removeEventListener("keydown", auClavier);
  }, []);

  /**
   * La recherche globale mène au catalogue, seule recherche que l'API expose
   * (`GET /api/produits?nom=`). Il n'y a pas d'endpoint de recherche
   * transversale : le champ ne prétend donc plus chercher ventes et clients.
   */
  function rechercher(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const requete = terme.trim();
    router.push(
      requete
        ? `/dashboard/produits?nom=${encodeURIComponent(requete)}`
        : "/dashboard/produits",
    );
  }

  return (
    <header className="flex items-center gap-4 border-b border-line bg-surface px-4 py-3 sm:px-6">
      <form onSubmit={rechercher} className="relative max-w-md flex-1" role="search">
        <label htmlFor="recherche-globale" className="sr-only">
          Rechercher un produit par son nom
        </label>
        <IconRecherche className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <input
          ref={champ}
          id="recherche-globale"
          type="search"
          value={terme}
          onChange={(e) => setTerme(e.target.value)}
          placeholder="Rechercher un produit…"
          className="h-10 w-full rounded-lg border border-line bg-plane pr-14 pl-9 text-sm text-ink placeholder:text-ink-3 focus:border-brand-400 focus:bg-surface"
        />
        <kbd className="absolute top-1/2 right-3 -translate-y-1/2 rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] text-ink-3">
          ⌘K
        </kbd>
      </form>

      <div className="ml-auto flex items-center gap-1">
        <Link
          href="/dashboard/produits"
          aria-label={
            alertes > 0
              ? `Notifications : ${nombre(alertes)} produit${alertes > 1 ? "s" : ""} sous le seuil de stock`
              : "Notifications : aucune alerte de stock"
          }
          className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-ink-2 transition-colors duration-200 hover:bg-plane hover:text-ink"
        >
          <IconCloche className="h-[18px] w-[18px]" />
          {alertes > 0 ? (
            <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-critical ring-2 ring-surface" />
          ) : null}
        </Link>
      </div>

      <Link
        href="/dashboard/parametres"
        className="flex items-center gap-2.5 border-l border-line pl-4 transition-colors duration-200 hover:text-brand-600"
      >
        <Avatar nom={nom} />
        <div className="hidden sm:block">
          <p className="text-[13px] leading-tight font-medium text-ink">{nom}</p>
          <p className="text-[11px] leading-tight text-ink-2">
            {libelleRole(utilisateur)} · {utilisateur.matricule}
          </p>
        </div>
      </Link>
    </header>
  );
}
