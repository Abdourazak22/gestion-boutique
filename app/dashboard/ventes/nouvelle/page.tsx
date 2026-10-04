import type { Metadata } from "next";
import { FormulaireVente } from "@/components/ventes/formulaire-vente";
import { EntetePage } from "@/components/ui/entete-page";

export const metadata: Metadata = { title: "Nouvelle vente" };

export default function PageNouvelleVente() {
  return (
    <>
      <EntetePage
        titre="Nouvelle vente"
        sousTitre="Composez le panier, puis encaissez. Le vendeur est celui du compte connecté."
      />
      <FormulaireVente />
    </>
  );
}
