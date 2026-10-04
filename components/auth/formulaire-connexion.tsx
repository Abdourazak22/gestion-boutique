"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCadenas, IconFleche, IconUtilisateur } from "@/components/icons";
import { messageErreur } from "@/lib/api";
import { seConnecter } from "@/lib/auth";
import { notifier } from "@/lib/notifier";
import { nomComplet } from "@/lib/types";

function Pastille({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-full w-12 shrink-0 items-center justify-center border-r border-white/10 bg-white/10 text-white/70"
    >
      {children}
    </span>
  );
}

const CHAMP =
  "flex h-12 items-stretch overflow-hidden rounded-lg border border-white/15 bg-black/35 backdrop-blur-sm transition-colors duration-200 focus-within:border-brand-300";

export function FormulaireConnexion() {
  const router = useRouter();
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [memoriser, setMemoriser] = useState(true);
  const [enCours, setEnCours] = useState(false);

  async function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setEnCours(true);
    try {
      const utilisateur = await seConnecter({
        identifiant,
        motDePasse,
        memoriser,
      });
      notifier.succes(`Bienvenue, ${nomComplet(utilisateur)}.`);
      // `replace` : l'écran de connexion n'a pas à rester dans l'historique,
      // le bouton « Précédent » ne doit pas y ramener une fois connecté.
      router.replace("/dashboard");
      // Pas de `setEnCours(false)` : le bouton reste inerte pendant la
      // navigation, qui démonte ce composant.
    } catch (erreurAppel) {
      notifier.erreur(messageErreur(erreurAppel));
      setEnCours(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={soumettre}>
      <div>
        <label
          htmlFor="identifiant"
          className="mb-2 block text-[13px] font-medium text-white/80"
        >
          Nom d’utilisateur
        </label>
        <div className={CHAMP}>
          <Pastille>
            <IconUtilisateur className="h-[18px] w-[18px]" />
          </Pastille>
          <input
            id="identifiant"
            name="identifiant"
            type="text"
            autoComplete="username"
            required
            autoFocus
            value={identifiant}
            onChange={(e) => setIdentifiant(e.target.value)}
            placeholder="gerant"
            className="w-full bg-transparent px-3 text-sm text-white placeholder:text-white/35 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="motdepasse"
          className="mb-2 block text-[13px] font-medium text-white/80"
        >
          Mot de passe
        </label>
        <div className={CHAMP}>
          <Pastille>
            <IconCadenas className="h-[18px] w-[18px]" />
          </Pastille>
          <input
            id="motdepasse"
            name="motdepasse"
            type="password"
            autoComplete="current-password"
            required
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            className="w-full bg-transparent px-3 text-sm text-white focus:outline-none"
          />
        </div>
      </div>

      {/* Se souvenir de moi + bouton flèche, comme dans la maquette.
          Case à cocher et non bouton radio : l'option est binaire. */}
      <div className="flex items-center justify-between gap-4 pt-1">
        <label
          htmlFor="memoriser"
          className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[13px] text-white/80 [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]"
        >
          <input
            id="memoriser"
            name="memoriser"
            type="checkbox"
            checked={memoriser}
            onChange={(e) => setMemoriser(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded accent-brand-500"
          />
          Se souvenir de moi
        </label>

        <button
          type="submit"
          disabled={enCours}
          aria-label="Se connecter"
          className="flex h-12 w-16 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-brand-500 text-white ring-1 ring-white/15 transition-colors duration-200 hover:bg-brand-400 disabled:cursor-progress disabled:bg-brand-600"
        >
          {enCours ? (
            <span
              aria-hidden="true"
              className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"
            />
          ) : (
            <IconFleche className="h-5 w-5 rotate-45" />
          )}
        </button>
      </div>
    </form>
  );
}
