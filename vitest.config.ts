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
    // `npm test` reste utilisable sans Docker. `e2e/**` : specs Playwright
    // (`npm run test:e2e`), pas vitest -- même pattern `*.spec.ts` par
    // défaut que vitest ramasserait sinon (import `@playwright/test`
    // incompris par vitest, échec de collecte).
    exclude: ["**/node_modules/**", "test/integration/**", "e2e/**"],
    // p1-3 (feuille de route Phase 1) : seuil PLANCHER anti-régression, pas
    // un objectif de 100% -- calé (07/09/2026) sur la couverture réelle du
    // jour (lib/**, tout le reste de l'app -- pages, composants -- n'a
    // aucun test unitaire et n'est pas dans le périmètre de cette mesure).
    // `include` explicite (Vitest 4, plus d'option `all` séparée -- voir
    // AGENTS.md) : sans ça, seuls les fichiers déjà importés par un test
    // auraient compté, gonflant artificiellement le pourcentage en ignorant
    // tout fichier de lib/ à 0 test.
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      exclude: [
        "lib/**/*.test.ts",
        // Testé séparément par test/integration/** (Docker/Supabase local,
        // voir vitest.integration.config.ts) -- compter ces fichiers ICI
        // les afficherait à 0% alors qu'ils ont 27 tests d'intégration.
        "lib/queries/**",
        // Fines enveloppes de création de client Supabase -- aucune
        // logique à tester sans un vrai serveur/navigateur derrière.
        "lib/supabase/**",
      ],
      thresholds: {
        statements: 30,
        branches: 25,
        functions: 35,
        lines: 30,
      },
    },
  },
});
