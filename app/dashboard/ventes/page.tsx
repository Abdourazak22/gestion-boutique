import type { Metadata } from "next";
import { TableVentes } from "@/components/ventes/table-ventes";
import { EntetePage, LienPrincipal } from "@/components/ui/entete-page";
import { IconPlus } from "@/components/icons";

export const metadata: Metadata = { title: "Ventes" };

export default function PageVentes() {
  return (
    <>
      <EntetePage
        titre="Ventes"
        sousTitre="Historique des achats clients. Un achat peut porter sur plusieurs produits."
        actions={
          <LienPrincipal href="/dashboard/ventes/nouvelle">
            <IconPlus className="h-4 w-4" />
            Nouvelle vente
          </LienPrincipal>
        }
      />
      <TableVentes />
    </>
  );
}
