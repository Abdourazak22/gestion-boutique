import { AxiosError, type AxiosRequestConfig, type AxiosResponse } from "axios";
import { api } from "./api";
import type { Achat } from "./types";

/**
 * Remplace l'adaptateur HTTP d'axios par une fonction de test.
 *
 * On garde ainsi la vraie chaîne d'intercepteurs : c'est précisément ce qu'on
 * veut vérifier. Mocker le module axios entier les court-circuiterait et le
 * test ne prouverait plus rien.
 */
export interface RequeteCapturee {
  url: string;
  method: string;
  headers: Record<string, unknown>;
  data: unknown;
}

export interface Reponse {
  statut: number;
  corps?: unknown;
}

export function brancherAdaptateur(reponses: Reponse | Reponse[]) {
  const file = Array.isArray(reponses) ? [...reponses] : [reponses];
  const capturees: RequeteCapturee[] = [];

  api.defaults.adapter = async (config: AxiosRequestConfig) => {
    const entetes = config.headers as unknown as {
      toJSON?: () => Record<string, unknown>;
    };
    capturees.push({
      url: config.url ?? "",
      method: (config.method ?? "get").toLowerCase(),
      headers: entetes?.toJSON ? entetes.toJSON() : {},
      data: config.data,
    });

    const prevue = file.length > 1 ? file.shift()! : file[0]!;
    const reponse = {
      data: prevue.corps,
      status: prevue.statut,
      statusText: String(prevue.statut),
      headers: {},
      config,
    } as AxiosResponse;

    if (prevue.statut >= 400) {
      throw new AxiosError(
        `Requête en échec : ${prevue.statut}`,
        String(prevue.statut),
        config as never,
        {},
        reponse,
      );
    }
    return reponse;
  };

  return capturees;
}

/** Remplace `window.location`, que jsdom refuse de laisser muter. */
export function simulerEmplacement(pathname: string) {
  const faux = { pathname, href: "" };
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: faux,
  });
  return faux;
}

/**
 * Achat de test complet, surchargeable champ par champ.
 *
 * La forme d'`Achat` grandit à chaque fonctionnalité — moyen de paiement,
 * statut d'annulation. Une fabrique évite d'avoir à retoucher chaque fixture
 * de chaque fichier de test à l'ajout d'un champ.
 */
export function achatDeTest(surcharges: Partial<Achat> = {}): Achat {
  return {
    id: 1,
    numero: "ACH-20261005-0001",
    nomClient: "Esther Kouadio",
    telephoneClient: "0700000000",
    dateAchat: "2026-10-05T11:42:00",
    vendeur: "Gerant Ouattara",
    modePaiement: "ESPECES",
    statut: "PAYE",
    motifAnnulation: null,
    commentaireAnnulation: null,
    dateAnnulation: null,
    annulePar: null,
    montantTotal: 18500,
    lignes: [],
    ...surcharges,
  };
}
