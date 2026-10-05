"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconDashboard,
  IconLivraisons,
  IconProduits,
  IconUtilisateurs,
  IconVentes,
} from "@/components/icons";

const RACINE = "/dashboard";

const onglets = [
  { href: RACINE, libelle: "Bord", Icone: IconDashboard },
  { href: `${RACINE}/ventes`, libelle: "Ventes", Icone: IconVentes },
  { href: `${RACINE}/livraisons`, libelle: "Livraisons", Icone: IconLivraisons },
  { href: `${RACINE}/produits`, libelle: "Produits", Icone: IconProduits },
  { href: `${RACINE}/utilisateurs`, libelle: "Équipe", Icone: IconUtilisateurs },
] as const;

/** Navigation principale sous 1024 px, où la barre latérale est masquée. */
export function NavMobile() {
  const chemin = usePathname();

  return (
    <nav
      /* Nom distinct de celui de la barre latérale : les deux coexistent dans
         le DOM et seul le CSS en masque une. Deux repères homonymes rendent la
         navigation au lecteur d'écran ambiguë dès que cette règle change. */
      aria-label="Onglets de navigation"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface lg:hidden"
    >
      <ul className="flex">
        {onglets.map(({ href, libelle, Icone }) => {
          const actif =
            href === RACINE ? chemin === RACINE : chemin.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={actif ? "page" : undefined}
                className={`flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 px-1 transition-colors duration-200 ${
                  actif ? "text-brand-600" : "text-ink-2"
                }`}
              >
                <Icone className="h-5 w-5" />
                <span className="text-[10px] font-medium">{libelle}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
