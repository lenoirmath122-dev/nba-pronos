import { defineConfig, devices } from "@playwright/test";
import { execSync } from "node:child_process";

// Suite e2e (C1, TEST-001) -- tape un vrai Next.js dev server branché sur un
// Supabase LOCAL (jamais le projet hébergé de .env.local), même principe que
// test/integration/ (A4) : lu dynamiquement via `supabase status`, jamais
// codé en dur. Nécessite `npx supabase start` au préalable (voir README.md).
function readLocalSupabaseEnv() {
  let raw = "";
  let lastError: unknown;
  // 2 essais : `npx supabase status` peut ponctuellement échouer sous
  // charge CLI (observé une fois pendant le développement de cette suite).
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      raw = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      lastError = undefined;
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError) {
    throw new Error("Supabase local injoignable -- lancer `npx supabase start` avant `npm run test:e2e`.");
  }
  const vars: Record<string, string> = {};
  for (const match of raw.matchAll(/^(\w+)="(.*)"$/gm)) vars[match[1]] = match[2];
  return vars;
}

const local = readLocalSupabaseEnv();

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  // Séquentiel plutôt que parallèle : chaque worker Playwright réévalue ce
  // fichier de config (donc rappelle `supabase status`) et tape le MÊME
  // serveur de dev -- avec seulement 3 specs, la contention entre workers
  // concurrents coûte plus en fiabilité qu'elle ne fait gagner en vitesse.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // "list" en console (lisible en local/CI logs) + "html" écrit sur disque
  // uniquement en CI (jamais ouvert automatiquement) -- exploitable comme
  // artefact en cas d'échec (voir .github/workflows/ci.yml, job e2e).
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  // Turbopack compile CHAQUE route à la demande, au 1er hit -- observé
  // jusqu'à ~8s sur la route de connexion (server action) seule, sur une
  // machine de dev pourtant pas particulièrement chargée (07/09/2026,
  // creusé en ajoutant les projets mobile-chrome/mobile-safari : le defaut
  // Playwright de 5000ms faisait échouer authenticate as playerA de façon
  // parfaitement reproductible, pas un flake). Un seul webServer partagé
  // par tous les projets (voir plus bas) -- seul le tout 1er hit de chaque
  // route paie ce coût, les projets suivants profitent du cache Turbopack.
  expect: { timeout: 15_000 },
  timeout: 45_000,
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: `${__dirname}/e2e/.auth/player-a.json` },
      dependencies: ["setup"],
    },
    // Viewport mobile (p1-2, feuille de route Phase 1) : l'app est
    // mobile-first (cf. son propre CSS -- breakpoints, tap targets 44px...)
    // mais n'était vérifiée qu'en Desktop Chrome jusqu'ici. Les 3 specs
    // existantes utilisent des locators par rôle/texte (getByRole/
    // getByLabel), jamais de coordonnées ni de survol -- aucune n'a eu
    // besoin d'adaptation pour passer sur ce nouveau projet.
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"], storageState: `${__dirname}/e2e/.auth/player-a.json` },
      dependencies: ["setup"],
    },
    // WebKit (p1-2 le demandait "si possible") essayé le 07/09/2026 sur un
    // projet "mobile-safari" (devices["iPhone 14"]) : 2 vrais échecs
    // reproductibles (pas des flakes), pas des adaptations de spec triviales
    // -- focus jamais restauré au déclencheur après Échap (T-UI-01, quirk
    // WebKit connu sur les <button>) et le flux de validation de prono qui
    // n'aboutit pas (T-UI-02, possiblement lié à hasTouch:true de
    // l'émulation iPhone). Mis de côté plutôt qu'activé à moitié -- voir
    // GAPS_OUVERTS.md pour le détail, à reprendre si jugé prioritaire.
  ],
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
      // Turnstile désactivé (widget ne se rend pas sans clé) : la CAPTCHA
      // locale est déjà désactivée côté GoTrue (supabase/config.toml,
      // [auth.captcha] commenté), donc le login réussit sans token.
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
      // Force le repli "non calculable" de structureBet() (return null
      // immédiat, AUCUN appel réseau) plutôt que de mocker le protocole de
      // sortie structurée du SDK Anthropic -- ce chemin de repli est déjà le
      // comportement voulu en cas de panne (voir lib/ai/structureBet.ts),
      // T-UI-03 vérifie le statut résultant (SUBMITTED, jamais auto-validé),
      // pas le succès de l'IA elle-même. Zéro coût, zéro dépendance réseau.
      ANTHROPIC_API_KEY: "",
    },
  },
});
