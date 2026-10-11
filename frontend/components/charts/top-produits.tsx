import type { ProduitVendu } from "@/lib/types";
import { fcfa, nombre, pourcent } from "@/lib/format";
import { Vide } from "@/components/ui/etats";

/**
 * Classement des produits par chiffre d'affaires. Barres horizontales triées,
 * teinte unique : le rang se lit à la longueur, pas à la couleur : une rampe
 * de valeur sur des catégories nominales ne ferait que redire la longueur.
 */
export function TopProduits({ produits }: { produits: ProduitVendu[] }) {
  if (produits.length === 0) {
    return (
      <div className="px-5 pb-5">
        <Vide titre="Aucune vente sur la période" />
      </div>
    );
  }

  const max = Math.max(...produits.map((p) => p.chiffreAffaires), 1);

  return (
    <figure className="px-5 pb-5">
      <ul className="space-y-3.5">
        {produits.map((p) => (
          <li key={p.produitId}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[13px] text-ink">{p.nom}</span>
              <span className="tnum shrink-0 text-[13px] font-semibold text-ink">
                {fcfa(p.chiffreAffaires)}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-plane">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${(p.chiffreAffaires / max) * 100}%` }}
              />
            </div>
            <p className="tnum mt-1 flex items-baseline gap-2 text-[11px] text-ink-2">
              <span>{nombre(p.quantite)} vendus</span>
              <span aria-hidden="true">·</span>
              <span>
                marge {fcfa(p.marge)}
                {p.chiffreAffaires > 0
                  ? ` (${pourcent((p.marge / p.chiffreAffaires) * 100, 1)})`
                  : ""}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </figure>
  );
}
