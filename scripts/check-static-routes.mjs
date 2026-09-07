#!/usr/bin/env node
// T-SMOKE-02 (audit/BACKLOG_TESTS.md §10, feuille de route p1-4) : détecte si
// une future page bascule accidentellement en statique alors qu'elle dépend
// de données de session -- le cache Vercel servirait alors la page d'un
// utilisateur à un autre (fuite de données entre comptes).
//
// `.next/prerender-manifest.json` (généré par `next build`) liste dans
// `routes` TOUTE route effectivement pré-rendue statiquement -- source plus
// fiable que de grep le tableau ƒ/○ imprimé en console (format susceptible
// de changer entre versions de Next, symboles ANSI). Ce script COMPARE cette
// liste à une allowlist figée : tout ce qui n'y figure pas fait échouer le
// script (exit 1), qu'il s'agisse d'une NOUVELLE route jamais vue (ajoutée
// sans être ajoutée à l'allowlist -- oubli probable) ou d'une route qui aurait
// dû rester dynamique.
import { readFile } from "node:fs/promises";
import path from "node:path";

const MANIFEST_PATH = path.join(process.cwd(), ".next", "prerender-manifest.json");

// Assets techniques uniquement -- AUCUNE page de l'app (app/(app)/**,
// app/(auth)/**, les pages légales) n'a sa place ici : toutes dépendent
// potentiellement de la session (cookies Supabase lus dans le layout racine,
// voir app/layout.tsx) même quand leur contenu semble "public" au premier
// abord (ex. /cgu, /mentions-legales -- servies par le même layout).
const ALLOWED_STATIC_ROUTES = new Set([
  "/_global-error", // page d'erreur générique interne à Next.js, jamais liée à une session.
  "/apple-icon.png",
  "/favicon.ico",
  "/manifest.webmanifest",
]);

async function main() {
  let raw;
  try {
    raw = await readFile(MANIFEST_PATH, "utf8");
  } catch {
    console.error(`Introuvable : ${MANIFEST_PATH} -- lancer \`npm run build\` avant ce script.`);
    process.exit(1);
  }

  const manifest = JSON.parse(raw);
  const staticRoutes = Object.keys(manifest.routes ?? {});
  const unexpected = staticRoutes.filter((route) => !ALLOWED_STATIC_ROUTES.has(route));

  if (unexpected.length > 0) {
    console.error("Route(s) pré-rendue(s) STATIQUEMENT de façon inattendue (risque de fuite de données entre utilisateurs) :");
    for (const route of unexpected) console.error(`  - ${route}`);
    console.error("\nSi c'est un ajout volontaire et sûr (page réellement publique, sans donnée de session), ajouter la route à ALLOWED_STATIC_ROUTES dans scripts/check-static-routes.mjs.");
    process.exit(1);
  }

  console.log(`OK -- ${staticRoutes.length} route(s) statique(s), toutes attendues (${staticRoutes.join(", ")}).`);
}

main();
