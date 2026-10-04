"use client";

import { useState } from "react";
import type { BarreVentes } from "@/lib/statistiques";
import { fcfa } from "@/lib/format";

/**
 * Montant encaissé par pas de temps sur la période choisie.
 *
 * Série unique : une seule teinte, aucune légende (le titre de la carte nomme
 * la série) et une seule valeur étiquetée en clair, celle du pas le plus fort.
 * Les autres se lisent au survol ou au clavier, et restent accessibles sans
 * pointeur dans le tableau de substitution.
 *
 * Rendu en HTML plutôt qu'en SVG : un viewBox mis à l'échelle rétrécirait les
 * libellés d'axe et déformerait les angles arrondis selon la largeur.
 */
export function VentesPeriode({ barres }: { barres: BarreVentes[] }) {
  const [survolee, setSurvolee] = useState<string | null>(null);

  // Toutes les barres à zéro : sans garde, la division donnerait NaN.
  const max = Math.max(...barres.map((b) => b.montant), 1);
  const indexMax = barres.findIndex((b) => b.montant === max && b.montant > 0);
  // Au-delà d'une vingtaine de pas, un libellé sur deux suffit à se repérer
  // et les étiquettes cessent de se chevaucher.
  const pasLibelle = barres.length > 20 ? Math.ceil(barres.length / 12) : 1;

  return (
    <figure className="px-5 pb-5">
      <div className="relative h-[168px]">
        {/* Graduations hairline, solides, un cran au-dessus de la surface */}
        {[0, 50, 100].map((part) => (
          <span
            key={part}
            aria-hidden="true"
            className="absolute inset-x-0 border-t border-line"
            style={{ bottom: `${part}%` }}
          />
        ))}

        <ol className="absolute inset-0 flex gap-[2px]">
          {barres.map((b, i) => (
            <li
              key={b.cle}
              className="relative flex h-full flex-1 flex-col justify-end"
              /* La cible de survol est toute la colonne, pas la seule barre :
                 une barre à 2 % de hauteur serait impossible à viser. */
              onPointerEnter={() => setSurvolee(b.cle)}
              onPointerLeave={() => setSurvolee(null)}
            >
              <button
                type="button"
                onFocus={() => setSurvolee(b.cle)}
                onBlur={() => setSurvolee(null)}
                aria-label={`${b.label} : ${fcfa(b.montant)}`}
                className="absolute inset-0 cursor-default rounded focus:outline-2 focus:outline-offset-2 focus:outline-brand-500"
              />

              <div
                aria-hidden="true"
                className={`mx-auto w-full max-w-6 rounded-t transition-colors duration-200 ${
                  survolee === b.cle ? "bg-brand-600" : "bg-brand-500"
                }`}
                style={{ height: `${Math.max((b.montant / max) * 86, 2)}%` }}
              />

              {/* Valeur en clair sur le pas le plus fort uniquement : un nombre
                  sur chaque barre ne se lit pas. */}
              {i === indexMax ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 text-center text-[11px] font-semibold whitespace-nowrap text-ink"
                  style={{ bottom: `${Math.max((b.montant / max) * 86, 2)}%` }}
                >
                  {fcfa(b.montant)}
                </span>
              ) : null}

              {survolee === b.cle && i !== indexMax ? (
                <Infobulle label={b.label} montant={b.montant} />
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-2 flex gap-[2px]">
        {barres.map((b, i) => (
          <span
            key={b.cle}
            className="flex-1 overflow-hidden text-center text-[11px] text-ink-3"
          >
            {i % pasLibelle === 0 ? b.label : ""}
          </span>
        ))}
      </div>

      {/* Tableau de substitution : toute valeur reste atteignable sans survol. */}
      <figcaption className="sr-only">
        <table>
          <caption>Montant encaissé par pas de temps sur la période</caption>
          <tbody>
            {barres.map((b) => (
              <tr key={b.cle}>
                <th scope="row">{b.label}</th>
                <td>{fcfa(b.montant)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}

/** La valeur mène, le libellé suit : ici le lecteur a le pas, il veut le montant. */
function Infobulle({ label, montant }: { label: string; montant: number }) {
  return (
    <span
      role="status"
      className="pointer-events-none absolute bottom-full left-1/2 z-10 -translate-x-1/2 rounded-lg border border-line bg-surface px-2 py-1 text-center shadow-sm"
    >
      <span className="block text-[11px] font-semibold whitespace-nowrap text-ink">
        {fcfa(montant)}
      </span>
      <span className="block text-[10px] whitespace-nowrap text-ink-2">{label}</span>
    </span>
  );
}
