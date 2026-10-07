#!/usr/bin/env node
// ============================================================================
// MATCH DU JOUR (DAILY_MATCH) — tirage d'un match NBA par jour, par lots
// ============================================================================
// Fichier  : scripts/daily-match-draw.mjs
// Usage    : node --conditions=react-server --env-file=.env.local \
//              scripts/daily-match-draw.mjs --from=2026-10-20 --to=2026-10-29 [--dry-run] [--seed=<hex>]
//              [--min-remaining=20]
//
// `--conditions=react-server` : lib/nba/client.ts (seul module autorisé à
// appeler Highlightly, règle C-1) importe "server-only", qui n'a une version
// vide que sous cette condition. Sans elle, l'import lève une erreur.
//
// Enveloppe mince : toute la logique (tirage, écritures, idempotence) est dans
// lib/dailyMatch/draw.ts::runDailyDraw, partagée avec la route
// /api/daily-match/draw (cron GitHub Actions + lancement manuel). Le cron
// automatique remplace l'usage courant de ce script ; il reste utile en local.
//
// - Idempotent : un jour qui a déjà une série ET un match est sauté. Pas de
//   retirage (décision utilisateur du 07/10/2026) : un match tiré ne change plus.
// - --dry-run : aucune écriture, mais consomme le même quota API.
// - Un lot = 10 jours max (quota API). S'arrête si le quota restant passe sous
//   --min-remaining.
// - Publication aux joueurs : 10h Paris le D-6 du jour NY du match (fenêtre
//   glissante de 7 jours, jamais avant le 19/10), filtrée côté
//   serveur (lib/dates/paris.ts::isDailyDayPublished) — rien à faire ici.
// ============================================================================

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getMatchesByDate, normalizeMatchStatus } from "../lib/nba/client.ts";
import { dailyPublishAt, isDailyDayPublished, nyDayToSlot } from "../lib/dates/paris.ts";
import { daysBetween, runDailyDraw, validateRange } from "../lib/dailyMatch/draw.ts";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être chargées (node --env-file=.env.local ...)."
  );
}

function parseArgs(argv) {
  const out = {};
  for (const raw of argv) {
    const m = /^--([a-zA-Z-]+)(?:=(.*))?$/.exec(raw);
    if (m) out[m[1]] = m[2] ?? true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const dryRun = args["dry-run"] === true;
const minRemaining = args["min-remaining"] ? Number(args["min-remaining"]) : 20;
const runSeed = typeof args.seed === "string" ? args.seed : randomBytes(16).toString("hex");

if (typeof args.from !== "string" || typeof args.to !== "string") {
  throw new Error("Usage : --from=YYYY-MM-DD --to=YYYY-MM-DD [--dry-run] [--seed=<hex>] [--min-remaining=20]");
}
if (!Number.isFinite(minRemaining)) throw new Error("--min-remaining doit être un nombre.");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const errors = validateRange(args.from, args.to, (day) => isDailyDayPublished(day, Date.now()));
  if (errors.length > 0) throw new Error(errors.join("\n"));

  // Affichée AVANT tout appel : si le run est interrompu, elle reste notée.
  console.log(`Graine du run : ${runSeed}${dryRun ? "  (--dry-run : aucune écriture)" : ""}`);

  const result = await runDailyDraw(
    {
      supabase,
      fetchDay: getMatchesByDate,
      isScheduled: (d) => {
        const n = normalizeMatchStatus(d);
        return n.recognized && n.status === "SCHEDULED";
      },
      toSlot: nyDayToSlot,
      publishAt: dailyPublishAt,
      log: (message) => console.log(message),
    },
    { days: daysBetween(args.from, args.to), dryRun, runSeed, minRemaining, source: "script" }
  );

  console.log(
    `\nTerminé : ${result.drawn.length} tiré(s)${dryRun ? " (simulation)" : ""}, ` +
      `${result.skipped.length} déjà tiré(s), ${result.empty.length} sans candidat.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("ÉCHEC :", err.message);
    process.exit(1);
  });
