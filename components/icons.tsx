import {
  ArrowUpRight,
  Bell,
  Check,
  LayoutDashboard,
  Lock,
  LogOut,
  Package,
  Plus,
  Printer,
  Search,
  Settings,
  ShoppingCart,
  Store,
  TriangleAlert,
  Truck,
  UserRound,
  Users,
  X,
  type LucideProps,
} from "lucide-react";

/**
 * Jeu d'icônes de l'application : les composants de `lucide-react`, exposés
 * sous le nom de ce qu'ils désignent dans la boutique (`IconVentes`) plutôt que
 * sous celui de leur dessin (`ShoppingCart`). Les écrans parlent ainsi métier,
 * et changer un pictogramme se fait ici, en un seul endroit.
 *
 * Deux réglages maison appliqués à chaque icône :
 *
 * - `strokeWidth` à 1,75 — Lucide livre 2 par défaut, toute l'interface a été
 *   dessinée au trait plus fin ;
 * - `aria-hidden` — les icônes sont décoratives, le sens est toujours porté par
 *   un libellé voisin ou l'`aria-label` du contrôle. Un appelant qui aurait
 *   besoin d'une icône annoncée peut le surcharger : la propagation de
 *   `{...props}` passe après les réglages.
 */
const reglages = { strokeWidth: 1.75, "aria-hidden": true } as const;

export const IconDashboard = (p: LucideProps) => (
  <LayoutDashboard {...reglages} {...p} />
);
export const IconVentes = (p: LucideProps) => <ShoppingCart {...reglages} {...p} />;
export const IconLivraisons = (p: LucideProps) => <Truck {...reglages} {...p} />;
export const IconProduits = (p: LucideProps) => <Package {...reglages} {...p} />;
export const IconUtilisateurs = (p: LucideProps) => <Users {...reglages} {...p} />;
export const IconRecherche = (p: LucideProps) => <Search {...reglages} {...p} />;
export const IconCloche = (p: LucideProps) => <Bell {...reglages} {...p} />;
export const IconImprimer = (p: LucideProps) => <Printer {...reglages} {...p} />;
export const IconFermer = (p: LucideProps) => <X {...reglages} {...p} />;
export const IconAlerte = (p: LucideProps) => <TriangleAlert {...reglages} {...p} />;
export const IconCheck = (p: LucideProps) => <Check {...reglages} {...p} />;
export const IconParametres = (p: LucideProps) => <Settings {...reglages} {...p} />;
export const IconDeconnexion = (p: LucideProps) => <LogOut {...reglages} {...p} />;
export const IconPlus = (p: LucideProps) => <Plus {...reglages} {...p} />;
export const IconBoutique = (p: LucideProps) => <Store {...reglages} {...p} />;

/* Pictogrammes des champs de l'écran de connexion. */
export const IconUtilisateur = (p: LucideProps) => (
  <UserRound {...reglages} {...p} />
);
export const IconCadenas = (p: LucideProps) => <Lock {...reglages} {...p} />;

/** Flèche diagonale montante. Pivotée de 45° sur l'écran de connexion. */
export const IconFleche = (p: LucideProps) => <ArrowUpRight {...reglages} {...p} />;
