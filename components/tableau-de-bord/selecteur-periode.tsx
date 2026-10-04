"use client";

import { useId, useState } from "react";
import {
  jourIso,
  periodePredefinie,
  type ClePeriode,
  type Periode,
} from "@/lib/statistiques";
import { dateCourte } from "@/lib/format";

const PRESETS = [
  { cle: "jour", libelle: "Aujourd’hui" },
  { cle: "semaine", libelle: "7 jours" },
  { cle: "mois", libelle: "Mois en cours" },
  { cle: "trimestre", libelle: "90 jours" },
] as const satisfies readonly { cle: Exclude<ClePeriode, "personnalise">; libelle: string }[];

/**
 * Unique rangée de filtres du tableau de bord : elle cadre tout ce qui suit,
 * de sorte que les chiffres de toutes les cartes parlent de la même période.
 * Les préréglages passent avant la plage libre — c'est ce qu'on choisit
 * neuf fois sur dix.
 */
export function SelecteurPeriode({
  periode,
  cleActive,
  onChanger,
}: {
  periode: Periode;
  cleActive: ClePeriode;
  onChanger: (periode: Periode, cle: ClePeriode) => void;
}) {
  const [ouvertPersonnalise, setOuvertPersonnalise] = useState(
    cleActive === "personnalise",
  );
  const idDu = useId();
  const idAu = useId();

  const aujourdhui = jourIso(new Date());

  function choisirPreset(cle: Exclude<ClePeriode, "personnalise">) {
    setOuvertPersonnalise(false);
    onChanger(periodePredefinie(cle), cle);
  }

  /** Une borne seule laisse la période incohérente : on la referme sur elle-même. */
  function changerBorne(champ: "du" | "au", valeur: string) {
    if (!valeur) return;
    const suivante = { ...periode, [champ]: valeur };
    if (suivante.du > suivante.au) {
      // Plutôt que d'envoyer une plage inversée que le serveur refuserait en
      // 409, on aligne l'autre borne sur celle qui vient d'être saisie.
      if (champ === "du") suivante.au = valeur;
      else suivante.du = valeur;
    }
    onChanger(suivante, "personnalise");
  }

  return (
    <section
      aria-label="Période analysée"
      className="mb-4 flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface p-3"
    >
      <div className="flex flex-wrap rounded-lg bg-plane p-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.cle}
            type="button"
            onClick={() => choisirPreset(p.cle)}
            aria-pressed={cleActive === p.cle}
            className={`cursor-pointer rounded-[6px] px-3 py-2 text-xs font-medium transition-colors duration-200 ${
              cleActive === p.cle
                ? "bg-surface text-ink shadow-sm"
                : "text-ink-2 hover:text-ink"
            }`}
          >
            {p.libelle}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOuvertPersonnalise((o) => !o)}
          aria-pressed={cleActive === "personnalise"}
          aria-expanded={ouvertPersonnalise}
          className={`cursor-pointer rounded-[6px] px-3 py-2 text-xs font-medium transition-colors duration-200 ${
            cleActive === "personnalise"
              ? "bg-surface text-ink shadow-sm"
              : "text-ink-2 hover:text-ink"
          }`}
        >
          Plage libre
        </button>
      </div>

      {ouvertPersonnalise ? (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={idDu} className="text-[11px] text-ink-2">
            Du
          </label>
          <input
            id={idDu}
            type="date"
            value={periode.du}
            max={aujourdhui}
            onChange={(e) => changerBorne("du", e.target.value)}
            className="tnum h-10 rounded-lg border border-line bg-plane px-2.5 text-sm text-ink focus:border-brand-400 focus:bg-surface"
          />
          <label htmlFor={idAu} className="text-[11px] text-ink-2">
            au
          </label>
          <input
            id={idAu}
            type="date"
            value={periode.au}
            max={aujourdhui}
            onChange={(e) => changerBorne("au", e.target.value)}
            className="tnum h-10 rounded-lg border border-line bg-plane px-2.5 text-sm text-ink focus:border-brand-400 focus:bg-surface"
          />
        </div>
      ) : (
        <p className="text-xs text-ink-2 sm:ml-auto">
          Du {dateCourte(periode.du)} au {dateCourte(periode.au)}
        </p>
      )}
    </section>
  );
}
