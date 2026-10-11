import type { Metadata } from "next";
import { EcranUtilisateurs } from "@/components/utilisateurs/ecran-utilisateurs";

export const metadata: Metadata = { title: "Utilisateurs" };

export default function PageUtilisateurs() {
  return <EcranUtilisateurs />;
}
