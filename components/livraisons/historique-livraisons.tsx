"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Erreur, PageHorsLimites, Squelette, Vide } from "@/components/ui/etats";
import { Pagination } from "@/components/produits/catalogue";
import { listerLivraisons } from "@/lib/livraisons";
import { useRequete } from "@/lib/requete";
import { dateLongue, fcfa, nombre } from "@/lib/format";

const PAR_PAGE = 10;

/** Réceptions grossistes, depuis `GET /api/livraisons`. */
export function HistoriqueLivraisons() {
  const [page, setPage] = useState(0);

  const { donnees, chargement, erreur, recharger } = useRequete(
    `livraisons?page=${page}`,
    (signal) => listerLivraisons({ page, size: PAR_PAGE }, signal),
  );

  if (erreur) return <Erreur message={erreur} onReessayer={recharger} />;

  if (chargement) {
    return (
      <div className="space-y-4">
        <Squelette className="h-28" />
        <Squelette className="h-64" />
      </div>
    );
  }

  const livraisons = donnees?.content ?? [];

  if (livraisons.length === 0) {
    return donnees && donnees.page.totalElements > 0 ? (
      <PageHorsLimites onRetour={() => setPage(0)} />
    ) : (
      <Vide
        titre="Aucune livraison enregistrée"
        indice="Les réceptions de grossistes apparaîtront ici."
      />
    );
  }

  // Agrégats de la page affichée : l'API ne propose pas de totaux calculés,
  // le libellé dit donc explicitement sur quoi ils portent.
  const montant = livraisons.reduce((somme, l) => somme + l.montantTotal, 0);
  const articles = livraisons.reduce(
    (somme, l) => somme + l.lignes.reduce((s, ligne) => s + ligne.quantite, 0),
    0,
  );
  const total = donnees?.page.totalElements ?? livraisons.length;
  const portee =
    total > livraisons.length
      ? `Sur les ${nombre(livraisons.length)} dernières livraisons`
      : "Sur l’ensemble des livraisons";

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat accent libelle="Montant réceptionné" valeur={fcfa(montant)} note={portee} />
        <Stat
          libelle="Livraisons enregistrées"
          valeur={nombre(total)}
          note="Toutes périodes confondues"
        />
        <Stat libelle="Articles entrés" valeur={nombre(articles)} note={portee} />
      </div>

      <div className="mt-4 grid gap-4">
        {livraisons.map((l) => (
          <Card key={l.id}>
            <CardHeader
              titre={l.nomGrossiste}
              sousTitre={`${l.numero} · ${dateLongue(l.dateLivraison)} · reçu par ${l.receptionniste}`}
              action={
                l.referenceBon ? (
                  <span className="tnum rounded-full bg-plane px-2.5 py-1 text-xs font-medium text-ink-2">
                    Bon {l.referenceBon}
                  </span>
                ) : undefined
              }
            />
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full min-w-[480px] text-left text-sm">
                <caption className="sr-only">
                  Produits de la livraison {l.numero}
                </caption>
                <thead>
                  <tr className="border-b border-line text-[11px] tracking-wide text-ink-2 uppercase">
                    <th scope="col" className="py-2 font-medium">Produit</th>
                    <th scope="col" className="py-2 text-right font-medium">Quantité</th>
                    <th scope="col" className="py-2 text-right font-medium">Prix d’achat</th>
                    <th scope="col" className="py-2 text-right font-medium">Sous-total</th>
                  </tr>
                </thead>
                <tbody>
                  {l.lignes.map((ligne) => (
                    <tr
                      key={ligne.produitId}
                      className="border-b border-line/70 last:border-0"
                    >
                      <td className="py-2.5 text-[13px] text-ink">
                        {ligne.nomProduit}
                      </td>
                      <td className="tnum py-2.5 text-right text-[13px] text-ink-2">
                        {nombre(ligne.quantite)}
                      </td>
                      <td className="tnum py-2.5 text-right text-[13px] text-ink-2">
                        {fcfa(ligne.prixUnitaire)}
                      </td>
                      <td className="tnum py-2.5 text-right text-[13px] font-medium text-ink">
                        {fcfa(ligne.montantLigne)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="pt-3 text-right text-[13px] font-medium text-ink-2">
                      Total de la livraison
                    </td>
                    <td className="tnum pt-3 text-right text-sm font-semibold text-ink">
                      {fcfa(l.montantTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        ))}
      </div>

      {donnees && donnees.page.totalPages > 1 ? (
        <Pagination
          page={donnees.page.number}
          total={donnees.page.totalPages}
          onChanger={setPage}
        />
      ) : null}
    </>
  );
}
