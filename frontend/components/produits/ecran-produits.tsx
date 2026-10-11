"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Catalogue } from "@/components/produits/catalogue";
import { FormulaireProduit } from "@/components/produits/formulaire-produit";
import { BoutonPrincipal, EntetePage } from "@/components/ui/entete-page";
import { IconPlus } from "@/components/icons";
import { useSession } from "@/components/auth/session";
import { Squelette } from "@/components/ui/etats";

/**
 * Écran Produits : le catalogue et, pour le gérant, la création d'un produit.
 *
 * Le bouton n'apparaît pas pour un vendeur : `POST /api/produits` est annoté
 * `@PreAuthorize("hasRole('GERANT')")`, lui proposer l'action ne mènerait qu'à
 * un 403. C'est un confort d'interface : l'autorisation reste celle du serveur.
 */
export function EcranProduits() {
  const { utilisateur } = useSession();
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  // Incrémentée après une création : le catalogue la porte dans sa clé de
  // requête, donc il se recharge.
  const [version, setVersion] = useState(0);

  const estGerant = utilisateur.role === "GERANT";

  return (
    <>
      <EntetePage
        titre="Produits"
        sousTitre="Catalogue de la boutique, prix d’achat et de vente, niveau de stock."
        actions={
          estGerant ? (
            <BoutonPrincipal onClick={() => setFormulaireOuvert(true)}>
              <IconPlus className="h-4 w-4" />
              Ajouter un produit
            </BoutonPrincipal>
          ) : undefined
        }
      />

      {/* `useSearchParams` dans une page prérendue impose une frontière
          Suspense, sinon le build de production échoue. */}
      <Suspense fallback={<Squelette className="h-96" />}>
        <CatalogueDepuisUrl version={version} estGerant={estGerant} />
      </Suspense>

      {/* Monté seulement à l'ouverture, et démonté à la fermeture : les champs
          sont non contrôlés, c'est le démontage qui garantit un formulaire
          vierge à chaque réouverture plutôt qu'une remise à zéro à la main. */}
      {estGerant && formulaireOuvert ? (
        <FormulaireProduit
          onFermer={() => setFormulaireOuvert(false)}
          onEnregistre={() => setVersion((v) => v + 1)}
        />
      ) : null}
    </>
  );
}

/**
 * Relaie le terme de recherche porté par l'URL (`?nom=`). La clé force le
 * remontage à chaque nouveau terme : l'état local du catalogue repart de la
 * bonne valeur, sans synchronisation manuelle dans un effet.
 */
function CatalogueDepuisUrl({
  version,
  estGerant,
}: {
  version: number;
  estGerant: boolean;
}) {
  const nom = useSearchParams().get("nom") ?? "";
  return (
    <Catalogue
      key={nom}
      version={version}
      rechercheInitiale={nom}
      estGerant={estGerant}
    />
  );
}
