import { Synthese } from "@/components/tableau-de-bord/synthese";
import { EntetePage, LienPrincipal } from "@/components/ui/entete-page";
import { IconPlus } from "@/components/icons";

export default function TableauDeBord() {
  return (
    <>
      <EntetePage
        titre="Tableau de bord"
        sousTitre="Suivez les ventes, les livraisons et l’état du stock de la boutique."
        actions={
          <LienPrincipal href="/dashboard/ventes/nouvelle">
            <IconPlus className="h-4 w-4" />
            Nouvelle vente
          </LienPrincipal>
        }
      />
      <Synthese />
    </>
  );
}
