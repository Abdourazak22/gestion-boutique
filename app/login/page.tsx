import type { Metadata } from "next";
import Link from "next/link";
import { FormulaireConnexion } from "@/components/auth/formulaire-connexion";
import { IconBoutique } from "@/components/icons";

export const metadata: Metadata = { title: "Connexion" };

export default function PageConnexion() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      {/* --- Ciel : dégradé plein cadre, horizon lumineux, premier plan sombre.
          La photo de référence n'est pas réutilisable telle quelle (le
          formulaire y est incrusté), l'ambiance est donc recomposée en CSS
          dans le vert de la marque plutôt que dans le bleu d'origine. --- */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: [
            // Halo chaud de l'horizon, placé bas pour laisser le formulaire
            // sur la moitié sombre, c'est ce qui porte le contraste.
            "radial-gradient(115% 40% at 50% 92%, rgba(248,231,183,0.82) 0%, rgba(248,231,183,0.14) 46%, rgba(248,231,183,0) 64%)",
            "radial-gradient(60% 28% at 74% 94%, rgba(231,166,96,0.48) 0%, rgba(231,166,96,0) 60%)",
            "radial-gradient(85% 55% at 20% 12%, rgba(90,196,133,0.20) 0%, rgba(90,196,133,0) 68%)",
            "linear-gradient(180deg, #05160e 0%, #0b3220 28%, #145435 48%, #1c7046 66%, #2d8d5c 82%, #35613f 92%, #111d14 100%)",
          ].join(","),
        }}
      />
      {/* Vignette haute : assombrit juste derrière le formulaire, sans éteindre
          l'horizon. Un voile plein cadre tuait toute la profondeur. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(3,10,6,0.58)_0%,rgba(3,10,6,0.46)_50%,rgba(3,10,6,0.38)_80%,rgba(3,10,6,0.10)_100%)]"
      />

      <main className="w-full max-w-[380px]">
        {/* Identité : la maquette d'origine n'affiche aucun nom de produit,
            un écran de connexion doit dire où l'on se connecte. */}
        <div className="mb-10 flex flex-col items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-white ring-1 ring-white/20">
            <IconBoutique className="h-5.5 w-5.5" />
          </span>
          <h1 className="text-lg font-semibold tracking-tight text-white">
            Boutique<span className="text-brand-300">Pro</span>
          </h1>
          <p className="text-center text-[13px] text-white/70 [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]">
            Connectez-vous pour accéder à la caisse et au stock.
          </p>
        </div>

        {/* Seul îlot interactif de l'écran : état du formulaire, appel à
            `POST /api/auth/connexion`, donc composant client isolé. */}
        <FormulaireConnexion />

        {/* Séparateur à point central, repris de la maquette */}
        <div className="mt-10 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/25" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/25" />
        </div>

        <p className="mt-6 text-center">
          <Link
            href="/login"
            className="text-[13px] text-white/85 underline underline-offset-4 transition-colors duration-200 [text-shadow:0_1px_3px_rgba(0,0,0,0.5)] hover:text-white"
          >
            Mot de passe oublié ?
          </Link>
        </p>

        <p className="mt-10 text-center text-[11px] text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.75)]">
          Identifiant perdu ? Contactez la gérante de la boutique.
        </p>
      </main>
    </div>
  );
}
