import { beforeEach, describe, expect, it } from "vitest";
import { api, champsErreur, jeton, messageErreur, statutHttp } from "./api";
import { consommerMessageDiffere } from "./messages-differes";
import { brancherAdaptateur, simulerEmplacement } from "./aide-test";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  simulerEmplacement("/dashboard");
});

describe("en-tête d'authentification", () => {
  it("joint le jeton aux requêtes ordinaires", async () => {
    jeton.ecrire("jeton-valide", true);
    const requetes = brancherAdaptateur({ statut: 200, corps: {} });

    await api.get("/produits");

    expect(requetes[0]!.headers.Authorization).toBe("Bearer jeton-valide");
  });

  /**
   * Le bug qui rendait la connexion impossible : un jeton périmé encore en
   * mémoire était envoyé à `/auth/connexion`, et le filtre de jeton de Spring
   * rejetait la requête en 401 avant tout examen du mot de passe.
   */
  it("n'envoie JAMAIS de jeton à la route de connexion", async () => {
    jeton.ecrire("jeton-perime", true);
    const requetes = brancherAdaptateur({ statut: 200, corps: {} });

    await api.post("/auth/connexion", { identifiant: "x", motDePasse: "y" });

    expect(requetes[0]!.headers.Authorization).toBeUndefined();
  });

  it("joint le jeton à la déconnexion, qui a besoin de savoir qui part", async () => {
    jeton.ecrire("jeton-valide", true);
    const requetes = brancherAdaptateur({ statut: 204 });

    await api.post("/auth/deconnexion");

    expect(requetes[0]!.headers.Authorization).toBe("Bearer jeton-valide");
  });

  it("n'invente pas d'en-tête quand aucun jeton n'est stocké", async () => {
    const requetes = brancherAdaptateur({ statut: 200, corps: {} });

    await api.get("/produits");

    expect(requetes[0]!.headers.Authorization).toBeUndefined();
  });
});

describe("401 sur une route protégée", () => {
  it("purge le jeton et prépare le message de reconnexion", async () => {
    jeton.ecrire("jeton-revoque", true);
    brancherAdaptateur({ statut: 401 });
    const emplacement = simulerEmplacement("/dashboard");

    await expect(api.get("/auth/moi")).rejects.toThrow();

    expect(jeton.lire()).toBeNull();
    expect(emplacement.href).toBe("/login");
    expect(consommerMessageDiffere()).toEqual({
      ton: "erreur",
      texte: expect.stringContaining("plus valide"),
    });
  });

  it("ne redirige pas si l'on est déjà sur la page de connexion", async () => {
    jeton.ecrire("jeton-revoque", true);
    brancherAdaptateur({ statut: 401 });
    const emplacement = simulerEmplacement("/login");

    await expect(api.get("/auth/moi")).rejects.toThrow();

    expect(jeton.lire()).toBeNull();
    expect(emplacement.href).toBe("");
  });
});

/**
 * Trois routes où un 401 veut dire autre chose que « session tombée ». Les
 * confondre déconnectait l'utilisateur pour un simple mauvais mot de passe.
 */
describe("401 attendu, qui ne doit pas déconnecter", () => {
  it.each([
    ["/auth/connexion", "identifiants refusés"],
    ["/auth/mot-de-passe", "mot de passe actuel faux"],
    ["/auth/deconnexion", "jeton déjà révoqué"],
  ])("conserve la session sur %s (%s)", async (route) => {
    jeton.ecrire("jeton-en-cours", true);
    brancherAdaptateur({ statut: 401 });
    const emplacement = simulerEmplacement("/dashboard");

    await expect(api.post(route)).rejects.toThrow();

    expect(emplacement.href).toBe("");
    expect(consommerMessageDiffere()).toBeNull();
  });
});

describe("stockage du jeton", () => {
  it("retient durablement quand « se souvenir de moi » est coché", () => {
    jeton.ecrire("abc", true);
    expect(window.localStorage.getItem("boutiquepro.token")).toBe("abc");
    expect(window.sessionStorage.getItem("boutiquepro.token")).toBeNull();
  });

  it("limite à l'onglet quand la case est décochée", () => {
    jeton.ecrire("abc", false);
    expect(window.sessionStorage.getItem("boutiquepro.token")).toBe("abc");
    expect(window.localStorage.getItem("boutiquepro.token")).toBeNull();
  });

  it("ne laisse pas un ancien jeton dans l'autre stockage", () => {
    jeton.ecrire("ancien", true);
    jeton.ecrire("nouveau", false);
    expect(jeton.lire()).toBe("nouveau");
    expect(window.localStorage.getItem("boutiquepro.token")).toBeNull();
  });

  it("efface les deux stockages", () => {
    jeton.ecrire("abc", true);
    jeton.effacer();
    expect(jeton.lire()).toBeNull();
  });
});

describe("lecture des erreurs de l'API", () => {
  it("préfère le message du serveur", () => {
    const erreur = { isAxiosError: true, response: { status: 409, data: { message: "Stock insuffisant" } } };
    expect(messageErreur(erreur)).toBe("Stock insuffisant");
  });

  it("se rabat sur le code quand la réponse n'a pas de message", () => {
    // C'est ce repli qui s'affichait quand Spring rejetait la connexion sur le
    // jeton : corps vide, donc aucun message à montrer.
    const erreur = { isAxiosError: true, response: { status: 401, data: "" } };
    expect(messageErreur(erreur)).toBe("Erreur 401 : la requête a échoué.");
  });

  it("distingue le serveur injoignable du serveur lent", () => {
    expect(messageErreur({ isAxiosError: true })).toBe("Impossible de joindre le serveur.");
    expect(messageErreur({ isAxiosError: true, code: "ECONNABORTED" })).toBe(
      "Le serveur met trop de temps à répondre.",
    );
  });

  it("extrait les erreurs par champ d'un 400 de validation", () => {
    const erreur = {
      isAxiosError: true,
      response: { status: 400, data: { champs: { nom: "Le nom est obligatoire", prixAchat: 42 } } },
    };
    // La valeur non textuelle est écartée : elle ne s'affiche pas sous un champ.
    expect(champsErreur(erreur)).toEqual({ nom: "Le nom est obligatoire" });
  });

  it("renvoie une carte vide quand il n'y a pas de champs", () => {
    expect(champsErreur({ isAxiosError: true, response: { status: 500, data: {} } })).toEqual({});
    expect(champsErreur(new Error("boum"))).toEqual({});
  });

  it("expose le code HTTP", () => {
    expect(statutHttp({ isAxiosError: true, response: { status: 429 } })).toBe(429);
    expect(statutHttp(new Error("boum"))).toBeUndefined();
  });
});
