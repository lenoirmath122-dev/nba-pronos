import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { isAuthorizedSyncRequest } from "@/lib/sync/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { getMatchesByDate, normalizeMatchStatus } from "@/lib/nba/client";
import { dailyPublishAt, isDailyDayPublished, nyDayToSlot, parisDateKey } from "@/lib/dates/paris";
import {
  CRON_MIN_REMAINING,
  cronDrawDays,
  daysBetween,
  runDailyDraw,
  validateManualRange,
} from "@/lib/dailyMatch/draw";

// Tirage automatique du Match du jour (PR 5), déclenché par le workflow GitHub
// Actions daily-match-draw.yml (Bearer SYNC_SECRET, comme /api/recaps).
// - Sans paramètre : mode cron. Tire les jours à venir de la fenêtre
//   (cronDrawDays), et ne fait rien en dehors de la période de la compétition.
// - ?from=&to= : lot manuel. `override=1` ignore les bornes de la compétition
//   ET le contrôle « jour déjà publié » (test sur un jour courant). `dry_run=1`
//   simule sans écrire.
// Un code non 2xx déclenche l'issue d'alerte du workflow : on le renvoie quand
// le match d'aujourd'hui ou de demain manque après le tirage (calendrier
// Highlightly vide) ou qu'aucune compétition DAILY_MATCH n'est active.
export const runtime = "nodejs";
export const maxDuration = 60;

async function handle(request: Request): Promise<Response> {
  if (!isAuthorizedSyncRequest(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const params = new URL(request.url).searchParams;
    const dryRun = params.get("dry_run") === "1";
    const from = params.get("from");
    const to = params.get("to");
    const manual = from !== null || to !== null;
    const nowMs = Date.now();
    const todayParis = parisDateKey(nowMs);

    let days: string[];
    if (manual) {
      if (!from || !to) return NextResponse.json({ error: "from et to vont ensemble." }, { status: 400 });
      const errors = validateManualRange(from, to, {
        override: params.get("override") === "1",
        isPublished: (day) => isDailyDayPublished(day, nowMs),
      });
      if (errors.length > 0) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
      days = daysBetween(from, to);
    } else {
      days = cronDrawDays(todayParis);
      if (days.length === 0) return NextResponse.json({ skipped: "hors période du Match du jour ou rien à tirer" });
    }

    const result = await runDailyDraw(
      {
        supabase: getServiceClient(),
        fetchDay: getMatchesByDate,
        isScheduled: (description) => {
          const normalized = normalizeMatchStatus(description);
          return normalized.recognized && normalized.status === "SCHEDULED";
        },
        toSlot: nyDayToSlot,
        publishAt: dailyPublishAt,
        log: (message) => console.log(`[daily-match-draw] ${message}`),
      },
      {
        days,
        dryRun,
        runSeed: randomBytes(16).toString("hex"),
        minRemaining: manual ? 20 : CRON_MIN_REMAINING,
        source: manual ? "manual" : "cron",
      }
    );

    // Mode cron : le match d'aujourd'hui et de demain (s'ils sont dans la
    // fenêtre tirée) doivent exister, sinon l'alerte doit être visible. Pas
    // d'alerte plus tôt : un jour tiré en retard reste jouable tant qu'il n'a
    // pas commencé, et un jour sans match connu (Thanksgiving) alerterait
    // chaque run pendant toute la durée de sa fenêtre.
    if (!manual) {
      const done = new Set([...result.drawn, ...result.skipped]);
      const tomorrow = parisDateKey(nowMs + 24 * 60 * 60 * 1000);
      const missing = days.filter((day) => day <= tomorrow && !done.has(day));
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Aucun match tiré pour ${missing.join(", ")} (calendrier vide ou quota).`, ...result },
          { status: 500 }
        );
      }
    }
    return NextResponse.json({ mode: manual ? "manual" : "cron", dryRun, days, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
