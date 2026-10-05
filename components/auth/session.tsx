"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { jeton, messageErreur } from "@/lib/api";
import { profil, seDeconnecter } from "@/lib/auth";
import { notifier } from "@/lib/notifier";
import type { Utilisateur } from "@/lib/types";

interface Session {
  utilisateur: Utilisateur;
  /** Révoque le jeton côté serveur puis renvoie vers l'écran de connexion. */
  deconnecter: () => Promise<void>;
  /** Vrai pendant l'appel de révocation : de quoi inhiber le bouton. */
  deconnexionEnCours: boolean;
}

const ContexteSession = createContext<Session | null>(null);

/** À n'appeler que sous `<FournisseurSession>`, donc dans `/dashboard`. */
export function useSession(): Session {
  const session = useContext(ContexteSession);
  if (!session) {
    throw new Error("useSession() exige un <FournisseurSession> parent.");
  }
  return session;
}

type Etat =
  | { phase: "chargement" }
  | { phase: "pret"; utilisateur: Utilisateur }
  | { phase: "erreur"; message: string };

/**
 * Charge la session à partir du jeton stocké et la met à disposition de
 * l'interface. Sans jeton, ou si le jeton est refusé, on repart vers /login.
 *
 * Ce garde-fou est une commodité d'affichage, pas une sécurité : le jeton vit
 * dans le navigateur, donc aucune vérification n'est possible côté serveur
 * Next. La véritable frontière est l'API Spring, qui exige le jeton sur
 * chaque `/api/**` : un utilisateur qui forcerait cet écran n'obtiendrait
 * aucune donnée.
 */
export function FournisseurSession({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [etat, setEtat] = useState<Etat>({ phase: "chargement" });
  // Incrémenté par « Réessayer » : relancer l'effet est le seul moyen de
  // redemander le profil sans remonter tout l'arbre.
  const [tentative, setTentative] = useState(0);

  useEffect(() => {
    if (!jeton.lire()) {
      router.replace("/login");
      return;
    }

    let actif = true;
    profil()
      .then((utilisateur) => {
        if (actif) setEtat({ phase: "pret", utilisateur });
      })
      .catch((erreur: unknown) => {
        // 401 : l'intercepteur d'`api.ts` a déjà purgé le jeton et déclenché
        // le retour vers /login. Ne reste ici que l'API injoignable ou en
        // erreur, cas où il faut le dire plutôt que tourner indéfiniment.
        if (actif) setEtat({ phase: "erreur", message: messageErreur(erreur) });
      });

    return () => {
      actif = false;
    };
  }, [router, tentative]);

  const reessayer = useCallback(() => {
    setEtat({ phase: "chargement" });
    setTentative((precedente) => precedente + 1);
  }, []);

  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);
  // Un second appel partirait sans jeton (le premier l'a effacé), donc en 401,
  // et l'intercepteur afficherait un « session expirée » mensonger.
  const deconnexionLancee = useRef(false);

  const deconnecter = useCallback(async () => {
    if (deconnexionLancee.current) return;
    deconnexionLancee.current = true;
    setDeconnexionEnCours(true);

    // Le serveur révoque le jeton ; sans cet appel il resterait valable
    // jusqu'à son expiration, donc rejouable.
    const revoque = await seDeconnecter();
    // `router.replace` conserve l'arbre React, donc le Toaster du layout
    // racine : pas besoin de différer ce message.
    if (revoque) {
      notifier.succes("Vous êtes déconnecté.");
    } else {
      notifier.erreur(
        "Déconnecté de cet appareil, mais le serveur n’a pas répondu : le jeton restera valable jusqu’à son expiration.",
      );
    }
    router.replace("/login");
  }, [router]);

  if (etat.phase === "chargement") {
    return (
      <output
        aria-busy="true"
        className="flex min-h-screen flex-1 items-center justify-center gap-3 text-sm text-ink-2"
      >
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand-500"
        />
        Chargement de la session…
      </output>
    );
  }

  if (etat.phase === "erreur") {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center px-4">
        <div className="max-w-sm text-center" role="alert">
          <h1 className="text-base font-semibold text-ink">
            Session indisponible
          </h1>
          <p className="mt-2 text-sm text-ink-2">{etat.message}</p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={reessayer}
              className="h-10 cursor-pointer rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-400"
            >
              Réessayer
            </button>
            <button
              type="button"
              onClick={deconnecter}
              disabled={deconnexionEnCours}
              className="h-10 cursor-pointer rounded-lg border border-line px-4 text-sm text-ink-2 transition-colors duration-200 hover:bg-plane hover:text-ink disabled:cursor-progress"
            >
              Retour à la connexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ContexteSession.Provider
      value={{ utilisateur: etat.utilisateur, deconnecter, deconnexionEnCours }}
    >
      {children}
    </ContexteSession.Provider>
  );
}
