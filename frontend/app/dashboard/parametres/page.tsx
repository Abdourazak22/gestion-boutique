import type { Metadata } from "next";
import { EcranParametres } from "@/components/parametres/ecran-parametres";
import { EntetePage } from "@/components/ui/entete-page";

export const metadata: Metadata = { title: "Paramètres" };

export default function PageParametres() {
  return (
    <>
      <EntetePage
        titre="Paramètres"
        sousTitre="Votre compte et votre mot de passe."
      />
      <EcranParametres />
    </>
  );
}
