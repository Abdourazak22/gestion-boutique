import type { Metadata } from "next";
import { FormulaireLivraison } from "@/components/livraisons/formulaire-livraison";
import { EntetePage } from "@/components/ui/entete-page";

export const metadata: Metadata = { title: "Nouvelle livraison" };

export default function PageNouvelleLivraison() {
  return (
    <>
      <EntetePage
        titre="Nouvelle livraison"
        sousTitre="Réception d’un grossiste. Le réceptionniste est le compte connecté."
      />
      <FormulaireLivraison />
    </>
  );
}
