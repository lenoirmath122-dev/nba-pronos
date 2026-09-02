import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { isAuthorizedSyncRequest } from "@/lib/sync/auth";
import { writeSyncLog } from "@/lib/sync/logging";
import { autoRevealAlphaMatches } from "@/lib/nbaCupAlpha/autoReveal";
import { resolveReferenceDate } from "@/lib/sync/devDateOverride";

// Auto-révélation des matchs fictifs "NBA Cup — Alpha Potes" (GAPS_OUVERTS.md,
// 02/09/2026) -- même patron que /api/sync/results (Bearer SYNC_SECRET,
// runtime Node, service_role), déclenché en cron toutes les 30 min par
// .github/workflows/nba-cup-alpha-reveal.yml. Remplace l'exécution manuelle
// de scripts/nba-cup-reveal-match.mjs le jour J : dès qu'un match fictif
// atteint son scheduled_at, il se révèle tout seul (score dérivé du vrai
// match NBA emprunté), exactement comme /api/sync/results détecte tout seul
// qu'un vrai match Highlightly est terminé en bêta.
//
// `?date=` : override dev/test UNIQUEMENT, même convention que /api/sync/*
// (lib/sync/devDateOverride.ts).
//
// syncType journalisé en "RESULTS" (pas de nouvelle valeur d'enum Postgres
// pour un mécanisme temporaire propre à l'alpha -- sync_type est un vrai
// `create type ... as enum`, une migration serait disproportionnée pour ~7
// matchs sur un mois) -- résumé distingue les 2 dans son texte.
export const runtime = "nodejs";

async function handle(request: Request): Promise<Response> {
  if (!isAuthorizedSyncRequest(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const supabase = getServiceClient();
  const dateParam = new URL(request.url).searchParams.get("date");
  const referenceDate = resolveReferenceDate(dateParam);

  try {
    const result = await autoRevealAlphaMatches(referenceDate);
    const summary =
      result.revealed.length === 0
        ? "Aucun match fictif à révéler."
        : `NBA Cup alpha -- ${result.revealed.length} match(s) révélé(s) (${result.revealed
            .map((r) => `${r.homeAbbr} ${r.homeScore}-${r.awayScore} ${r.awayAbbr}`)
            .join("; ")}), ${result.betsResolved} pari(s) résolu(s)` +
          (result.nextRoundCreated.length > 0
            ? `, ${result.nextRoundCreated.length} match(s) du tour suivant créé(s) (${result.nextRoundCreated.map((c) => c.label).join("; ")})`
            : "") +
          "." +
          (result.skipped.length > 0 ? ` Ignorés : ${result.skipped.map((s) => `${s.matchId} (${s.reason})`).join("; ")}.` : "");
    await writeSyncLog(supabase, {
      syncType: "RESULTS",
      endpoint: "/nba-cup-alpha/auto-reveal",
      success: true,
      summary,
      requestsRemaining: null,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    await writeSyncLog(supabase, {
      syncType: "RESULTS",
      endpoint: "/nba-cup-alpha/auto-reveal",
      success: false,
      summary: message,
      requestsRemaining: null,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
