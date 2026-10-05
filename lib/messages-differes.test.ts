import { beforeEach, describe, expect, it, vi } from "vitest";
import { consommerMessageDiffere, differerMessage } from "./messages-differes";

const CLE = "boutiquepro.message";

beforeEach(() => {
  window.sessionStorage.clear();
});

/**
 * L'expiration de session renvoie vers /login par un rechargement complet :
 * tout toast émis juste avant serait détruit avec la page. Le message est donc
 * rangé, et la page d'arrivée l'affiche.
 */
describe("messages qui survivent à une navigation", () => {
  it("rend le message rangé", () => {
    differerMessage("erreur", "Votre session n'est plus valide.");
    expect(consommerMessageDiffere()).toEqual({
      ton: "erreur",
      texte: "Votre session n'est plus valide.",
    });
  });

  it("ne le rend qu'une seule fois", () => {
    differerMessage("succes", "Mot de passe modifié.");
    expect(consommerMessageDiffere()).not.toBeNull();
    expect(consommerMessageDiffere()).toBeNull();
  });

  it("renvoie null quand rien n'attend", () => {
    expect(consommerMessageDiffere()).toBeNull();
  });

  it("vide toujours le stockage, même sur contenu invalide", () => {
    window.sessionStorage.setItem(CLE, "{ ceci n'est pas du json");
    expect(consommerMessageDiffere()).toBeNull();
    expect(window.sessionStorage.getItem(CLE)).toBeNull();
  });
});

/**
 * Le contenu vient du stockage du navigateur : il peut avoir été modifié à la
 * main. On ne lui fait donc pas confiance.
 */
describe("robustesse face à un stockage trafiqué", () => {
  it("tolère un JSON corrompu", () => {
    window.sessionStorage.setItem(CLE, "pas du json du tout");
    expect(consommerMessageDiffere()).toBeNull();
  });

  it("replie un ton inconnu sur « erreur »", () => {
    window.sessionStorage.setItem(CLE, JSON.stringify({ ton: "n_importe_quoi", texte: "ok" }));
    expect(consommerMessageDiffere()).toEqual({ ton: "erreur", texte: "ok" });
  });

  it("rejette un texte qui n'est pas une chaîne", () => {
    window.sessionStorage.setItem(CLE, JSON.stringify({ ton: "succes", texte: 42 }));
    expect(consommerMessageDiffere()).toBeNull();
  });

  it("rejette une valeur nulle", () => {
    window.sessionStorage.setItem(CLE, "null");
    expect(consommerMessageDiffere()).toBeNull();
  });

  it("ne jette pas quand le stockage est inaccessible", () => {
    // Navigation privée, stockage bloqué : l'accès lui-même peut lever.
    const espion = vi
      .spyOn(window.sessionStorage, "getItem")
      .mockImplementation(() => {
        throw new Error("stockage refusé");
      });

    expect(() => consommerMessageDiffere()).not.toThrow();
    expect(consommerMessageDiffere()).toBeNull();

    espion.mockRestore();
  });

  it("n'échoue pas à l'écriture quand le stockage refuse", () => {
    const espion = vi.spyOn(window.sessionStorage, "setItem").mockImplementation(() => {
      throw new Error("quota dépassé");
    });

    expect(() => differerMessage("erreur", "message perdu")).not.toThrow();

    espion.mockRestore();
  });
});
