"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { messageErreur } from "./api";

interface Resultat<T> {
  donnees: T | null;
  chargement: boolean;
  erreur: string | null;
  recharger: () => void;
}

/**
 * Charge une ressource de l'API côté navigateur.
 *
 * Le jeton vit dans le `localStorage`, donc hors de portée du serveur Next :
 * toutes les lectures de données passent nécessairement par le client. Ce hook
 * est le point unique où ce chargement est orchestré.
 *
 * `cle` identifie la requête (URL et paramètres). Le chargement n'est pas un
 * état posé à la main mais une déduction : tant que les données en mémoire ne
 * portent pas la clé courante, c'est qu'elles sont en route.
 */
export function useRequete<T>(
  cle: string,
  charger: (signal: AbortSignal) => Promise<T>,
): Resultat<T> {
  const [etat, setEtat] = useState<{
    cle: string | null;
    donnees: T | null;
    erreur: string | null;
  }>({ cle: null, donnees: null, erreur: null });
  const [tentative, setTentative] = useState(0);
  // La tentative fait partie de l'identité de la requête : sans elle, un
  // rechargement explicite sur la même clé ne se verrait pas.
  const cleEffective = `${tentative}#${cle}`;

  // La fonction de chargement est souvent une lambda recréée à chaque rendu :
  // la garder dans une ref évite d'en faire une dépendance, donc une boucle.
  const chargerRef = useRef(charger);
  useEffect(() => {
    chargerRef.current = charger;
  });

  useEffect(() => {
    const controleur = new AbortController();

    chargerRef
      .current(controleur.signal)
      .then((donnees) => {
        if (!controleur.signal.aborted) {
          setEtat({ cle: cleEffective, donnees, erreur: null });
        }
      })
      .catch((erreur: unknown) => {
        // Requête annulée (clé changée, composant démonté) : ce n'est pas une
        // erreur à montrer, la requête suivante a déjà pris le relais.
        if (axios.isCancel(erreur) || controleur.signal.aborted) return;
        setEtat({ cle: cleEffective, donnees: null, erreur: messageErreur(erreur) });
      });

    return () => controleur.abort();
  }, [cleEffective]);

  const recharger = useCallback(() => setTentative((n) => n + 1), []);

  return {
    donnees: etat.donnees,
    chargement: etat.cle !== cleEffective,
    erreur: etat.erreur,
    recharger,
  };
}
