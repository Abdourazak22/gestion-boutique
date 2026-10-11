import type { ReactNode } from "react";
import { IconFleche } from "@/components/icons";

/**
 * Tuile de KPI. La variante « accent » reprend la carte mise en avant de la
 * maquette de référence ; le reste de la rangée reste sur fond blanc pour que
 * l'accent désigne bien une seule mesure.
 */
export function Stat({
  libelle,
  valeur,
  evolution,
  note,
  accent = false,
}: {
  libelle: string;
  valeur: string;
  evolution?: { sens: "hausse" | "baisse"; texte: string };
  note?: ReactNode;
  accent?: boolean;
}) {
  return (
    <article
      className={`rounded-card border p-5 ${
        accent
          ? "border-brand-900 bg-brand-900 text-white"
          : "border-line bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3
          className={`text-[13px] font-medium ${accent ? "text-white/80" : "text-ink-2"}`}
        >
          {libelle}
        </h3>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full ${
            accent ? "bg-white/15 text-white" : "bg-plane text-ink-2"
          }`}
          aria-hidden="true"
        >
          <IconFleche className="h-3.5 w-3.5" />
        </span>
      </div>

      <p
        /* Le suffixe « FCFA » allonge la valeur : taille réduite jusqu'à 2xl
           pour qu'un montant à sept chiffres tienne sur une seule ligne.
           Chiffres proportionnels et non tabulaires : à cette taille, des
           chasses égales font paraître le nombre distendu. */
        className={`mt-3 text-2xl leading-none font-semibold whitespace-nowrap 2xl:text-[28px] ${
          accent ? "text-white" : "text-ink"
        }`}
      >
        {valeur}
      </p>

      {evolution ? (
        <p
          className={`mt-3 flex items-center gap-1.5 text-[11px] ${
            accent ? "text-brand-200" : "text-ink-2"
          }`}
        >
          <span
            aria-hidden="true"
            className={accent ? "text-brand-200" : "text-brand-500"}
          >
            {evolution.sens === "hausse" ? "▲" : "▼"}
          </span>
          {evolution.texte}
        </p>
      ) : null}

      {note ? (
        <p
          className={`mt-3 text-[11px] ${accent ? "text-white/70" : "text-ink-2"}`}
        >
          {note}
        </p>
      ) : null}
    </article>
  );
}
