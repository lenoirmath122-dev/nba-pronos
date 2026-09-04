import { defineConfig } from "vitest/config";
import path from "node:path";

// Résout l'alias "@/*" (tsconfig.json) pour que les fichiers testés puissent
// s'importer entre eux exactement comme dans l'app Next.js — sans ça,
// tout module de lib/ qui importe via "@/..." échouerait sous vitest.
//
// "server-only" (lib/supabase/service.ts) choisit son export via la
// condition de résolution "react-server", posée par le bundler de Next.js
// mais absente sous vitest — sans cet alias, tout import de service.ts
// lèverait "This module cannot be imported from a Client Component". Ici,
// aucun composant React n'est rendu (tests purs Node) : neutraliser ce
// garde-fou pour les tests est sûr, il reste actif dans le vrai build Next.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    // Les tests d'intégration (test/integration/**) exigent un Supabase local
    // (`npx supabase start`) et se lancent séparément via `npm run
    // test:integration` (vitest.integration.config.ts) -- exclus ici pour que
    // `npm test` reste utilisable sans Docker.
    exclude: ["**/node_modules/**", "test/integration/**"],
  },
});
