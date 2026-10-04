"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { Champ, liaisonsChamp, Saisie } from "@/components/ui/champ";
import { Erreur, Squelette, Vide } from "@/components/ui/etats";
import { IconAlerte, IconFermer, IconPlus, IconRecherche } from "@/components/icons";
import { enregistrerLivraison, type LivraisonRequete } from "@/lib/livraisons";
import { listerProduits } from "@/lib/produits";
import { useRequete } from "@/lib/requete";
import { notifier } from "@/lib/notifier";
import { libelleUnite, type Produit } from "@/lib/types";
import { fcfa, nombre } from "@/lib/format";

/**
 * Réception d'une livraison grossiste (`POST /api/livraisons`, rôle GERANT).
 *
 * Même forme que la caisse, avec deux différences tenues de l'API : le stock
 * entre au lieu de sortir, donc aucun plafond de quantité, et le prix unitaire
 * est saisissable — laissé vide, le serveur reprend le prix d'achat courant du
 * produit (`LivraisonService`). Un produit ne peut figurer qu'une fois.
 */
interface LigneLivraison {
  produit: Produit;
  quantite: number;
  /** Chaîne et non nombre : vide signifie « reprendre le prix d'achat ». */
  prix: string;
}

const PAR_PAGE = 8;

export function FormulaireLivraison() {
  const router = useRouter();
  const [saisie, setSaisie] = useState("");
  const [recherche, setRecherche] = useState("");
  const [lignes, setLignes] = useState<LigneLivraison[]>([]);
  const [nomGrossiste, setNomGrossiste] = useState("");
  const [referenceBon, setReferenceBon] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreurGrossiste, setErreurGrossiste] = useState<string>();

  useEffect(() => {
    const minuteur = setTimeout(() => setRecherche(saisie), 300);
    return () => clearTimeout(minuteur);
  }, [saisie]);

  const catalogue = useRequete(`livraison-produits?nom=${recherche}`, (signal) =>
    listerProduits({ nom: recherche, page: 0, size: PAR_PAGE }, signal),
  );

  const prixEffectif = (l: LigneLivraison): number =>
    l.prix.trim() === "" ? l.produit.prixAchat : Number(l.prix);

  const total = useMemo(
    () => lignes.reduce((somme, l) => somme + prixEffectif(l) * l.quantite, 0),
    [lignes],
  );

  function ajouter(produit: Produit) {
    setLignes((courantes) =>
      courantes.some((l) => l.produit.id === produit.id)
        ? // Regroupement : le serveur refuse deux lignes sur le même produit.
          courantes.map((l) =>
            l.produit.id === produit.id ? { ...l, quantite: l.quantite + 1 } : l,
          )
        : [...courantes, { produit, quantite: 1, prix: "" }],
    );
  }

  const majLigne = (produitId: number, champs: Partial<LigneLivraison>) =>
    setLignes((courantes) =>
      courantes.map((l) => (l.produit.id === produitId ? { ...l, ...champs } : l)),
    );

  const retirer = (produitId: number) =>
    setLignes((courantes) => courantes.filter((l) => l.produit.id !== produitId));

  async function enregistrer() {
    if (nomGrossiste.trim() === "") {
      setErreurGrossiste("Le nom du grossiste est obligatoire.");
      return;
    }
    setErreurGrossiste(undefined);
    setEnCours(true);

    const requete: LivraisonRequete = {
      nomGrossiste: nomGrossiste.trim(),
      referenceBon: referenceBon.trim() || undefined,
      lignes: lignes.map((l) => ({
        produitId: l.produit.id,
        quantite: l.quantite,
        // Omis plutôt qu'à zéro : c'est l'absence qui déclenche la reprise du
        // prix d'achat côté serveur.
        prixUnitaire: l.prix.trim() === "" ? undefined : Number(l.prix),
      })),
    };

    try {
      await notifier.pendant(enregistrerLivraison(requete), {
        attente: "Enregistrement de la livraison…",
        succes: (livraison) => `Livraison ${livraison.numero} enregistrée.`,
      });
      router.replace("/dashboard/livraisons");
    } catch {
      catalogue.recharger();
      setEnCours(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
      <Card className="min-w-0">
        <CardHeader
          titre="Choisir les produits reçus"
          sousTitre="Cliquez sur un produit pour l’ajouter au bon."
        />

        <div className="px-5">
          <div className="relative">
            <label htmlFor="recherche-livraison" className="sr-only">
              Rechercher un produit par son nom
            </label>
            <IconRecherche className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              id="recherche-livraison"
              type="search"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              autoFocus
              placeholder="Nom du produit…"
              className="h-11 w-full rounded-lg border border-line bg-plane pr-3 pl-9 text-sm text-ink placeholder:text-ink-3 focus:border-brand-400 focus:bg-surface"
            />
          </div>
        </div>

        <div className="px-5 py-4">
          {catalogue.erreur ? (
            <Erreur message={catalogue.erreur} onReessayer={catalogue.recharger} />
          ) : catalogue.chargement ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Squelette key={i} className="h-16" />
              ))}
            </div>
          ) : catalogue.donnees?.content.length === 0 ? (
            <Vide
              titre="Aucun produit trouvé"
              indice="Un produit doit exister au catalogue avant d’être réceptionné."
            />
          ) : (
            <ul className="space-y-2">
              {catalogue.donnees?.content.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => ajouter(p)}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-3 text-left transition-colors duration-200 hover:border-brand-300 hover:bg-brand-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">
                        {p.nom}
                      </p>
                      <p className="tnum mt-0.5 text-[11px] text-ink-2">
                        Achat {fcfa(p.prixAchat)} · {nombre(p.quantiteStock)}{" "}
                        {libelleUnite[p.unite]} en stock
                      </p>
                    </div>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <IconPlus className="h-4 w-4" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card className="h-fit xl:sticky xl:top-6">
        <CardHeader
          titre="Bon de livraison"
          sousTitre={
            lignes.length === 0
              ? "Aucune ligne"
              : `${nombre(lignes.length)} ligne${lignes.length > 1 ? "s" : ""}`
          }
        />

        <div className="grid gap-4 px-5">
          <Champ
            id="nomGrossiste"
            libelle="Grossiste"
            obligatoire
            erreur={erreurGrossiste}
          >
            <Saisie
              {...liaisonsChamp("nomGrossiste", erreurGrossiste)}
              value={nomGrossiste}
              onChange={(e) => setNomGrossiste(e.target.value)}
              maxLength={120}
              placeholder="Ets Traoré"
              erreur={erreurGrossiste}
            />
          </Champ>

          <Champ
            id="referenceBon"
            libelle="Référence du bon"
            indice="Facultative."
          >
            <Saisie
              {...liaisonsChamp("referenceBon", undefined, true)}
              value={referenceBon}
              onChange={(e) => setReferenceBon(e.target.value)}
              maxLength={60}
              placeholder="BL-4421"
            />
          </Champ>
        </div>

        <div className="mt-4 border-t border-line px-5 py-4">
          {lignes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-xs text-ink-2">
              Ajoutez un produit depuis la liste pour composer le bon.
            </p>
          ) : (
            <ul className="space-y-4">
              {lignes.map((l) => (
                <li key={l.produit.id}>
                  <div className="flex items-start gap-3">
                    <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                      {l.produit.nom}
                    </p>
                    <button
                      type="button"
                      onClick={() => retirer(l.produit.id)}
                      aria-label={`Retirer ${l.produit.nom} du bon`}
                      className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-2 transition-colors duration-200 hover:bg-plane hover:text-critical"
                    >
                      <IconFermer className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <label
                        htmlFor={`quantite-${l.produit.id}`}
                        className="mb-1 block text-[11px] text-ink-2"
                      >
                        Quantité reçue
                      </label>
                      <input
                        id={`quantite-${l.produit.id}`}
                        type="number"
                        value={l.quantite}
                        min={1}
                        step={1}
                        inputMode="numeric"
                        onChange={(e) =>
                          majLigne(l.produit.id, {
                            quantite: Math.max(1, Number(e.target.value)),
                          })
                        }
                        className="tnum h-10 w-full rounded-lg border border-line bg-plane px-2 text-sm text-ink focus:border-brand-400 focus:bg-surface"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`prix-${l.produit.id}`}
                        className="mb-1 block text-[11px] text-ink-2"
                      >
                        Prix payé
                      </label>
                      <input
                        id={`prix-${l.produit.id}`}
                        type="number"
                        value={l.prix}
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        placeholder={String(l.produit.prixAchat)}
                        onChange={(e) =>
                          majLigne(l.produit.id, { prix: e.target.value })
                        }
                        className="tnum h-10 w-full rounded-lg border border-line bg-plane px-2 text-sm text-ink placeholder:text-ink-3 focus:border-brand-400 focus:bg-surface"
                      />
                    </div>
                  </div>

                  <p className="tnum mt-1.5 text-right text-[11px] text-ink-2">
                    {l.prix.trim() === "" ? "Prix d’achat courant · " : ""}
                    {fcfa(prixEffectif(l) * l.quantite)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-line px-5 py-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-ink-2">Total du bon</span>
            <span className="tnum text-xl font-semibold text-ink">{fcfa(total)}</span>
          </div>

          <button
            type="button"
            onClick={enregistrer}
            disabled={lignes.length === 0 || enCours}
            className="mt-4 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-500 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-500/50"
          >
            {enCours ? "Enregistrement…" : "Enregistrer la livraison"}
          </button>

          <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-ink-2">
            <IconAlerte className="mt-px h-3.5 w-3.5 shrink-0 text-ink-3" />
            Le stock est incrémenté à l’enregistrement. Un prix laissé vide
            reprend le prix d’achat courant du produit.
          </p>
        </div>
      </Card>
    </div>
  );
}
