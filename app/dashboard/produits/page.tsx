import type { Metadata } from "next";
import { EcranProduits } from "@/components/produits/ecran-produits";

export const metadata: Metadata = { title: "Produits" };

export default function PageProduits() {
  return <EcranProduits />;
}
