import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Chaque test repart d'un DOM vierge : sans cela, les composants montés par un
// test précédent restent dans le document et faussent les recherches par rôle.
afterEach(() => {
  cleanup();
});
