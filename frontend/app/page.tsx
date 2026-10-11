import { redirect } from "next/navigation";

/**
 * Point d'entrée de l'application : on arrive sur l'écran de connexion.
 * Le tableau de bord vit sur `/dashboard`, accessible une fois authentifié.
 */
export default function Racine() {
  redirect("/login");
}
