import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll } from "vitest";

// Chaque test repart d'un DOM vierge : sans cela, les composants montés par un
// test précédent restent dans le document et faussent les recherches par rôle.
afterEach(() => {
  cleanup();
});

/**
 * jsdom n'implémente pas l'API modale de `<dialog>`. Sans ce substitut, tout
 * composant appelant `showModal()` lève et l'écran n'est pas inspectable.
 *
 * Il ne reproduit que l'ouverture et la fermeture, de quoi rendre le contenu
 * et le soumettre à axe. Ce que le navigateur fournit en plus et qui reste
 * donc NON vérifié ici : le piège à focus, l'inertie de l'arrière-plan et la
 * fermeture par la touche Échap.
 */
beforeAll(() => {
  const prototype = window.HTMLDialogElement.prototype;

  if (!prototype.showModal) {
    prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (!prototype.show) {
    prototype.show = function show(this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (!prototype.close) {
    prototype.close = function close(this: HTMLDialogElement, valeur?: string) {
      this.open = false;
      if (valeur !== undefined) this.returnValue = valeur;
      this.dispatchEvent(new Event("close"));
    };
  }
});
