"use client";

import toast from "react-hot-toast";
import { messageErreur } from "./api";
import { differerMessage, type TonMessage } from "./messages-differes";

/**
 * Point d'entrée unique des notifications éphémères.
 *
 * Un toast sert à accuser réception d'une action : il apparaît, il part. Il ne
 * remplace pas l'état d'un écran — un chargement qui échoue reste affiché en
 * place, avec son bouton « Réessayer » (voir `components/ui/etats.tsx`), sinon
 * l'utilisateur se retrouve devant une page vide dont le message a disparu.
 */

/** 4 s par défaut dans la librairie : trop court pour lire un diagnostic. */
const DUREE_ERREUR = 6000;

export const notifier = {
  erreur(texte: string): void {
    toast.error(texte, {
      duration: DUREE_ERREUR,
      // Par défaut la librairie annonce en « polite » : une erreur doit
      // interrompre la lecture d'écran, pas attendre une pause.
      ariaProps: { role: "alert", "aria-live": "assertive" },
    });
  },

  succes(texte: string): void {
    toast.success(texte);
  },

  /**
   * Suit une écriture du début à la fin : « en cours » pendant l'appel, puis
   * le résultat. Rend la promesse telle quelle, donc l'appelant garde la main
   * sur la suite (redirection, rechargement) et sur l'erreur.
   */
  pendant<T>(
    promesse: Promise<T>,
    textes: {
      attente: string;
      /** Fonction pour nommer le résultat : « Ticket ACH-… enregistré. » */
      succes: string | ((resultat: T) => string);
    },
  ): Promise<T> {
    return toast.promise(promesse, {
      loading: textes.attente,
      success: (resultat: T) =>
        typeof textes.succes === "function" ? textes.succes(resultat) : textes.succes,
      error: (erreur: unknown) => messageErreur(erreur),
    });
  },

  /** Message à afficher après une navigation ou un rechargement complet. */
  apresRedirection(ton: TonMessage, texte: string): void {
    differerMessage(ton, texte);
  },
};
