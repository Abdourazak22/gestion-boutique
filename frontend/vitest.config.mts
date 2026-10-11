import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Configuration de test, dérivée de la recette officielle de Next 16
 * (`node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`).
 *
 * Seule différence : la doc installe `vite-tsconfig-paths` pour résoudre les
 * alias `@/...`, mais Vite 8 le fait nativement via `resolve.tsconfigPaths` et
 * signale le greffon comme superflu. On s'en passe donc.
 */
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Le client HTTP lit `NEXT_PUBLIC_API_URL` au chargement du module et jette
    // si elle manque : on la fournit ici plutôt que de dépendre du `.env` local.
    env: {
      NEXT_PUBLIC_API_URL: "http://api.test/api",
      NEXT_PUBLIC_API_TIMEOUT: "1000",
    },
    globals: true,
    include: ["{lib,components,app}/**/*.test.{ts,tsx}"],
  },
});
