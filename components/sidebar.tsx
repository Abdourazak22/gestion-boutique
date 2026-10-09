"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/components/auth/session";
import {
  IconBoutique,
  IconDashboard,
  IconDeconnexion,
  IconLivraisons,
  IconParametres,
  IconProduits,
  IconUtilisateurs,
  IconVentes,
} from "@/components/icons";

/** Racine de la section, alignée sur le dossier `app/dashboard/`. */
const RACINE = "/dashboard";

const menu = [
  { href: RACINE, libelle: "Tableau de bord", Icone: IconDashboard },
  { href: `${RACINE}/ventes`, libelle: "Ventes", Icone: IconVentes },
  { href: `${RACINE}/livraisons`, libelle: "Livraisons", Icone: IconLivraisons },
  { href: `${RACINE}/produits`, libelle: "Produits", Icone: IconProduits },
  { href: `${RACINE}/utilisateurs`, libelle: "Utilisateurs", Icone: IconUtilisateurs },
] as const;

export function Sidebar() {
  const chemin = usePathname();
  const { deconnecter, deconnexionEnCours } = useSession();

  return (
    // `self-start` est indispensable et non décoratif : enfant d'un conteneur
    // flex, l'aside s'étirerait par défaut à la hauteur de toute la page, et un
    // élément collant aussi haut que son conteneur ne colle jamais. Associé à
    // `h-screen`, il tient la hauteur de la fenêtre et reste en place pendant
    // que le contenu défile.
    //
    // `overflow-y-auto` est une précaution : le menu tient aujourd'hui dans
    // n'importe quel écran, mais s'il s'allongeait, ses derniers liens
    // deviendraient inatteignables.
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col self-start overflow-y-auto bg-shell text-white lg:flex">
      <div className="flex items-center gap-2.5 px-5 py-6">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
          <IconBoutique className="h-4.5 w-4.5" />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">
          Boutique<span className="text-brand-300">X</span>
        </span>
      </div>

      <nav className="flex-1 px-3" aria-label="Navigation principale">
        <p className="px-2 pb-2 text-[10px] font-semibold tracking-[0.12em] text-white/40 uppercase">
          Gestion
        </p>
        <ul className="space-y-0.5">
          {menu.map(({ href, libelle, Icone }) => {
            // Égalité stricte sur la racine : `startsWith` la garderait
            // active sur toutes les sous-pages.
            const actif =
              href === RACINE ? chemin === RACINE : chemin.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={actif ? "page" : undefined}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-200 ${
                    actif
                      ? "bg-shell-soft font-medium text-white"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icone className="h-[18px] w-[18px]" />
                  {libelle}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="px-2 pt-6 pb-2 text-[10px] font-semibold tracking-[0.12em] text-white/40 uppercase">
          Général
        </p>
        <ul className="space-y-0.5">
          <li>
            <Link
              href={`${RACINE}/parametres`}
              aria-current={chemin.startsWith(`${RACINE}/parametres`) ? "page" : undefined}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-200 ${
                chemin.startsWith(`${RACINE}/parametres`)
                  ? "bg-shell-soft font-medium text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <IconParametres className="h-[18px] w-[18px]" />
              Paramètres
            </Link>
          </li>
          <li>
            {/* Bouton et non lien : la déconnexion efface le jeton avant de
                quitter l'écran, ce n'est pas une simple navigation. */}
            <button
              type="button"
              onClick={deconnecter}
              disabled={deconnexionEnCours}
              className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-white/60 transition-colors duration-200 hover:bg-white/5 hover:text-white disabled:cursor-progress disabled:text-white/40"
            >
              <IconDeconnexion className="h-[18px] w-[18px]" />
              {deconnexionEnCours ? "Déconnexion…" : "Déconnexion"}
            </button>
          </li>
        </ul>
      </nav>

    </aside>
  );
}
