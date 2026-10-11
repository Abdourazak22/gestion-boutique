import { beforeEach, describe, expect, it } from "vitest";
import { changerMotDePasse, profil, seConnecter, seDeconnecter } from "./auth";
import { jeton } from "./api";
import { brancherAdaptateur, simulerEmplacement } from "./aide-test";

const UTILISATEUR = {
  id: 1,
  nom: "Ouattara",
  prenom: "Gerant",
  matricule: "MAT-0001",
  sexe: "MASCULIN",
  dateNaissance: "1985-01-15",
  identifiant: "gerant",
  role: "GERANT",
  actif: true,
};

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  simulerEmplacement("/login");
});

describe("connexion", () => {
  it("stocke le jeton et renvoie l'utilisateur", async () => {
    brancherAdaptateur({
      statut: 200,
      corps: { jeton: "nouveau-jeton", typeJeton: "Bearer", expireDansSecondes: 7200, utilisateur: UTILISATEUR },
    });

    const u = await seConnecter({ identifiant: "gerant", motDePasse: "gerant123", memoriser: true });

    expect(u.identifiant).toBe("gerant");
    expect(jeton.lire()).toBe("nouveau-jeton");
  });

  /**
   * Second garde-fou contre le blocage de connexion : même si l'en-tête était
   * joint par erreur, un jeton résiduel ne survit pas à la tentative.
   */
  it("efface tout jeton résiduel avant d'essayer", async () => {
    jeton.ecrire("jeton-perime", true);
    brancherAdaptateur({ statut: 401, corps: { message: "Identifiant ou mot de passe incorrect" } });

    await expect(
      seConnecter({ identifiant: "gerant", motDePasse: "faux", memoriser: true }),
    ).rejects.toThrow();

    expect(jeton.lire()).toBeNull();
  });

  it("respecte « se souvenir de moi » décoché", async () => {
    brancherAdaptateur({
      statut: 200,
      corps: { jeton: "jeton-de-session", typeJeton: "Bearer", expireDansSecondes: 7200, utilisateur: UTILISATEUR },
    });

    await seConnecter({ identifiant: "gerant", motDePasse: "gerant123", memoriser: false });

    expect(window.sessionStorage.getItem("boutiquex.token")).toBe("jeton-de-session");
    expect(window.localStorage.getItem("boutiquex.token")).toBeNull();
  });
});

/**
 * Oublier le jeton côté navigateur ne suffisait pas : il restait valable
 * jusqu'à son expiration, donc rejouable s'il avait fuité.
 */
describe("déconnexion", () => {
  it("appelle le serveur pour révoquer, puis efface localement", async () => {
    jeton.ecrire("jeton-valide", true);
    const requetes = brancherAdaptateur({ statut: 204 });

    const revoque = await seDeconnecter();

    expect(requetes[0]!.url).toBe("/auth/deconnexion");
    expect(requetes[0]!.method).toBe("post");
    expect(revoque).toBe(true);
    expect(jeton.lire()).toBeNull();
  });

  it("considère un 401 comme réussi : le jeton était déjà révoqué", async () => {
    jeton.ecrire("jeton-deja-revoque", true);
    brancherAdaptateur({ statut: 401 });

    expect(await seDeconnecter()).toBe(true);
    expect(jeton.lire()).toBeNull();
  });

  it("efface quand même si le serveur est injoignable, et le signale", async () => {
    jeton.ecrire("jeton-valide", true);
    brancherAdaptateur({ statut: 500 });

    expect(await seDeconnecter()).toBe(false);
    expect(jeton.lire()).toBeNull();
  });
});

describe("profil et mot de passe", () => {
  it("lit le profil du porteur du jeton", async () => {
    jeton.ecrire("jeton-valide", true);
    const requetes = brancherAdaptateur({ statut: 200, corps: UTILISATEUR });

    expect((await profil()).matricule).toBe("MAT-0001");
    expect(requetes[0]!.url).toBe("/auth/moi");
  });

  it("envoie l'ancien et le nouveau mot de passe", async () => {
    jeton.ecrire("jeton-valide", true);
    const requetes = brancherAdaptateur({ statut: 204 });

    await changerMotDePasse("ancien123", "nouveau456");

    expect(requetes[0]!.url).toBe("/auth/mot-de-passe");
    expect(requetes[0]!.method).toBe("patch");
    expect(JSON.parse(requetes[0]!.data as string)).toEqual({
      motDePasseActuel: "ancien123",
      nouveauMotDePasse: "nouveau456",
    });
  });

  it("ne déconnecte pas sur un mot de passe actuel refusé", async () => {
    jeton.ecrire("jeton-valide", true);
    brancherAdaptateur({ statut: 401 });
    const emplacement = simulerEmplacement("/dashboard");

    await expect(changerMotDePasse("faux", "nouveau456")).rejects.toThrow();

    expect(emplacement.href).toBe("");
  });
});
