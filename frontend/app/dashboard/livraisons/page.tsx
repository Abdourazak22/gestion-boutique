import type { Metadata } from "next";
import { EcranLivraisons } from "@/components/livraisons/ecran-livraisons";

export const metadata: Metadata = { title: "Livraisons" };

export default function PageLivraisons() {
  return <EcranLivraisons />;
}
