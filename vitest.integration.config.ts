import { defineConfig } from "vitest/config";
import path from "node:path";

// Config séparée pour les tests d'intégration RLS (A4, TEST-002) : ils tapent
// un vrai Postgres via un Supabase local (`npx supabase start`), donc plus
// lents et non exécutables sans Docker -- gardés hors de `npm test`.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    include: ["test/integration/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
    // Chaque suite crée SA PROPRE compétition ACTIVE -- un index partiel
    // unique (migration initiale) n'en tolère qu'une seule à la fois en
    // base. Fichiers en série (pas de fileParallelism) pour ne jamais faire
    // chevaucher 2 suites sur ce point.
    fileParallelism: false,
  },
});
