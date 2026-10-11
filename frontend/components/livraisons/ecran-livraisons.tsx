"use client";

import { HistoriqueLivraisons } from "@/components/livraisons/historique-livraisons";
import { EntetePage, LienPrincipal } from "@/components/ui/entete-page";
import { IconPlus } from "@/components/icons";
import { useSession } from "@/components/auth/session";

/**
 * Écran Livraisons. L'enregistrement est réservé au gérant
 * (`@PreAuthorize("hasRole('GERANT')")` sur `POST /api/livraisons`) : c'est lui
 * qui achète au grossiste. Un vendeur consulte l'historique sans y accéder.
 */
export function EcranLivraisons() {
  const { utilisateur } = useSession();

  return (
    <>
      <EntetePage
        titre="Livraisons"
        sousTitre="Réceptions des grossistes. Une livraison concerne plusieurs produits."
        actions={
          utilisateur.role === "GERANT" ? (
            <LienPrincipal href="/dashboard/livraisons/nouvelle">
              <IconPlus className="h-4 w-4" />
              Enregistrer une livraison
            </LienPrincipal>
          ) : undefined
        }
      />
      <HistoriqueLivraisons />
    </>
  );
}
