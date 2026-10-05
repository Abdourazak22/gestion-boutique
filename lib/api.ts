import axios, {
  type AxiosInstance,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import { differerMessage } from "./messages-differes";

/**
 * Client HTTP unique de l'application.
 *
 * Côté navigateur on vise `NEXT_PUBLIC_API_URL` ; côté serveur (Server
 * Components, Route Handlers) on vise `API_URL`, qui peut pointer vers un nom
 * de service interne inaccessible depuis le poste de l'utilisateur.
 */
const SUR_LE_SERVEUR = typeof window === "undefined";

const baseURL = SUR_LE_SERVEUR
  ? (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL)
  : process.env.NEXT_PUBLIC_API_URL;

if (!baseURL) {
  // Mieux vaut échouer au démarrage qu'émettre des requêtes vers `undefined/...`.
  throw new Error(
    "Configuration manquante : renseignez NEXT_PUBLIC_API_URL (et API_URL) dans .env (voir .env.example).",
  );
}

const CLE_JETON = "boutiquepro.token";

export const api: AxiosInstance = axios.create({
  baseURL,
  timeout: Number(process.env.NEXT_PUBLIC_API_TIMEOUT ?? 10_000),
  headers: { "Content-Type": "application/json" },
});

/**
 * Jeton d'authentification, conservé côté navigateur uniquement.
 *
 * Deux stockages selon « Se souvenir de moi » : `localStorage` survit à la
 * fermeture du navigateur, `sessionStorage` meurt avec l'onglet. On lit dans
 * les deux, on n'écrit que dans un seul.
 */
export const jeton = {
  lire(): string | null {
    if (SUR_LE_SERVEUR) return null;
    try {
      return (
        window.localStorage.getItem(CLE_JETON) ??
        window.sessionStorage.getItem(CLE_JETON)
      );
    } catch {
      // Navigation privée ou stockage bloqué : on se comporte comme non connecté.
      return null;
    }
  },
  ecrire(valeur: string, memoriser = true): void {
    if (SUR_LE_SERVEUR) return;
    try {
      const retenu = memoriser ? window.localStorage : window.sessionStorage;
      const ecarte = memoriser ? window.sessionStorage : window.localStorage;
      // Purge de l'autre stockage : sans quoi un ancien jeton y resterait
      // lisible et primerait au prochain `lire()`.
      ecarte.removeItem(CLE_JETON);
      retenu.setItem(CLE_JETON, valeur);
    } catch {
      /* stockage indisponible : la session ne survivra pas au rechargement */
    }
  },
  effacer(): void {
    if (SUR_LE_SERVEUR) return;
    try {
      window.localStorage.removeItem(CLE_JETON);
      window.sessionStorage.removeItem(CLE_JETON);
    } catch {
      /* rien à faire */
    }
  },
};

/**
 * Routes qui établissent la session : y joindre un jeton n'a aucun sens, et
 * c'est nuisible.
 *
 * Le filtre de jeton de Spring Security s'exécute avant les règles
 * d'autorisation : un jeton invalide ou révoqué encore en mémoire fait rejeter
 * la requête en 401, corps vide, avant tout examen des identifiants. Comme
 * un 401 sur la connexion ne purge volontairement pas le stockage (un mauvais
 * mot de passe ne doit pas déconnecter), le jeton périmé rendait la connexion
 * définitivement impossible.
 */
const ROUTES_SANS_JETON = ["/auth/connexion"];

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const url = config.url ?? "";
  if (ROUTES_SANS_JETON.some((route) => url.endsWith(route))) {
    config.headers.delete("Authorization");
    return config;
  }

  const valeur = jeton.lire();
  if (valeur) config.headers.Authorization = `Bearer ${valeur}`;
  return config;
});

/**
 * Routes où un 401 ne dit pas « votre session est tombée » :
 *
 * - `connexion` et `mot-de-passe` : des identifiants refusés. Sans cette
 *   exception, un mauvais mot de passe actuel dans l'écran Paramètres
 *   déconnecterait l'utilisateur au lieu de lui signaler sa faute.
 * - `deconnexion` : le jeton était déjà révoqué, ce qui est précisément
 *   l'état recherché. Rediriger en annonçant une erreur serait absurde.
 */
const ROUTES_SANS_REDIRECTION_401 = [
  "/auth/connexion",
  "/auth/mot-de-passe",
  "/auth/deconnexion",
];

const quatreCentUnAttendu = (erreur: AxiosError): boolean => {
  const url = erreur.config?.url ?? "";
  return ROUTES_SANS_REDIRECTION_401.some((route) => url.endsWith(route));
};

api.interceptors.response.use(
  (reponse) => reponse,
  (erreur: AxiosError) => {
    // Jeton plus valable : on le purge et on renvoie vers la connexion. Ce
    // n'est plus seulement l'expiration : le serveur révoque aussi sur
    // changement de mot de passe, désactivation du compte et déconnexion
    // globale, d'où un message qui couvre les deux cas.
    if (
      erreur.response?.status === 401 &&
      !SUR_LE_SERVEUR &&
      !quatreCentUnAttendu(erreur)
    ) {
      jeton.effacer();
      if (window.location.pathname !== "/login") {
        // Le rechargement qui suit détruirait un toast émis maintenant :
        // le message est rangé, la page de connexion l'affichera.
        differerMessage(
          "erreur",
          "Votre session n’est plus valide, veuillez vous reconnecter.",
        );
        // Rechargement complet assumé plutôt qu'un router.push : on sort d'un
        // intercepteur, hors de React, et à l'expiration de session on veut
        // précisément repartir d'un état client vide.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login";
      }
    }
    return Promise.reject(erreur);
  },
);

/** Code HTTP de la réponse en erreur, s'il y en a eu une. */
export function statutHttp(erreur: unknown): number | undefined {
  return axios.isAxiosError(erreur) ? erreur.response?.status : undefined;
}

/**
 * Erreurs par champ d'un 400 de validation. Les clés sont les noms de champs du
 * DTO Spring (`nom`, `prixAchat`…), ce qui permet de les afficher sous l'input
 * correspondant plutôt que de résumer « Requête invalide ».
 */
export function champsErreur(erreur: unknown): Record<string, string> {
  if (!axios.isAxiosError(erreur)) return {};
  const corps = erreur.response?.data as
    | { champs?: Record<string, unknown> }
    | undefined;
  const champs = corps?.champs;
  if (!champs || typeof champs !== "object") return {};

  return Object.fromEntries(
    Object.entries(champs).filter(
      (entree): entree is [string, string] => typeof entree[1] === "string",
    ),
  );
}

/** Message d'erreur présentable, quelle que soit la forme de la réponse. */
export function messageErreur(erreur: unknown): string {
  if (axios.isAxiosError(erreur)) {
    const corps = erreur.response?.data as { message?: string } | undefined;
    if (corps?.message) return corps.message;
    if (erreur.code === "ECONNABORTED") return "Le serveur met trop de temps à répondre.";
    if (!erreur.response) return "Impossible de joindre le serveur.";
    return `Erreur ${erreur.response.status} : la requête a échoué.`;
  }
  return "Une erreur inattendue est survenue.";
}
