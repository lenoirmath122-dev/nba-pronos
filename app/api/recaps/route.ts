import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/sync/auth";
import { runRecaps } from "@/lib/recaps/sendRecaps";
import { runLeaderboardSnapshot } from "@/lib/snapshots/leaderboardSnapshot";
import { runWeeklyFreeze } from "@/lib/weekly/freezeWeek";
import { deadlineFrom } from "@/lib/weeklyPopup/config";
import { ensureWeeklyPopupDraft } from "@/lib/weeklyPopup/ensure";

// Cette route fige aussi le snapshot du classement (une fois par jour, après
// 10h Paris, jamais réécrit). Crons Vercel à 8h, 9h et 10h UTC : 10h Paris
// tombe à 8h UTC en été et 9h UTC en hiver, 10h UTC sert de rattrapage.
//
// Récaps du matin (p3-10) : push journalier, hebdo le lundi. Même garde
// d'authentification que /api/reminders/* (Bearer SYNC_SECRET, service_role)
// — déclenché par un cron Vercel (vercel.json, fiable) et par GitHub Actions (secours, souvent en retard de plusieurs heures). `?force=1` ignore la
// fenêtre 10h-13h (Paris), pour un déclenchement manuel ; la déduplication
// (recap_log) s'applique toujours. Exception : en compétition « Match du
// jour », rien n'est envoyé avant 10h même avec force (le match du jour n'est
// pas encore publié, voir runRecaps).
// Popup hebdo (lot 5) : la génération LLM tourne dans `after()` et partage la
// durée maximale de cette route (Fluid Compute actif, 300 s). Littéral exigé
// par Next (segment config statique) ; `maxDuration.test.ts` le garde égal à
// ROUTE_MAX_DURATION_S, d'où se calcule l'échéance de la génération.
export const maxDuration = 300;
export const runtime = "nodejs";

async function handle(request: Request): Promise<Response> {
  // Début de la requête : la durée maximale compte depuis ici.
  const requestStartMs = Date.now();
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const params = new URL(request.url).searchParams;
    const force = params.get("force") === "1";
    // `?only_owner=1` : push limité au compte du propriétaire (OWNER_USER_ID,
    // variable serveur), jamais à un identifiant passé en paramètre — même avec
    // le secret, ce mode ne peut que restreindre l'envoi.
    let onlyUserId: string | undefined;
    if (params.get("only_owner") === "1") {
      const owner = process.env.OWNER_USER_ID ?? "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(owner)) {
        return NextResponse.json({ error: "OWNER_USER_ID absent ou invalide." }, { status: 400 });
      }
      onlyUserId = owner;
    }
    const now = Date.now();
    // Figement du classement d'abord (le classement hebdo en dépend), isolé
    // des récaps : l'un qui plante ne bloque pas l'autre. `force` et
    // `only_owner` ne le concernent pas, il garde sa propre garde des 10h.
    const snapshot = await runLeaderboardSnapshot(now).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({
        ok: false as const,
        error: error instanceof Error ? error.message : "Erreur inconnue.",
      }),
    );
    // Figement hebdomadaire (classement hebdo, lot 1) : après le snapshot du
    // jour, avant les récaps, isolé lui aussi. Sans effet tant que
    // `competitions.weekly_ranking` est faux ; échoue explicitement si la
    // migration n'est pas poussée.
    const weekly = await runWeeklyFreeze(now).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({
        ok: false as const,
        error: error instanceof Error ? error.message : "Erreur inconnue.",
      }),
    );
    // Popup hebdo (lot 5) : à CHAQUE passage, pas seulement quand le figement
    // vient d'avoir lieu (« déjà figé » est le cas normal des passages 2 et 3).
    // Seule la réservation de la ligne est synchrone ; la génération part dans
    // after(), donc après les récaps. Sans effet tant que
    // `competitions.weekly_popup` est faux ; échoue explicitement si la
    // migration n'est pas poussée.
    const popup = await ensureWeeklyPopupDraft(now, {
      trigger: "CRON",
      deadlineMs: deadlineFrom(requestStartMs),
    }).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({
        ok: false as const,
        error: error instanceof Error ? error.message : "Erreur inconnue.",
      }),
    );
    const recaps = await runRecaps(now, { force, onlyUserId }).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({
        ok: false as const,
        error: error instanceof Error ? error.message : "Erreur inconnue.",
      }),
    );

    const body = {
      snapshot: snapshot.ok ? snapshot.value : { error: snapshot.error },
      weekly: weekly.ok ? weekly.value : { error: weekly.error },
      popup: popup.ok ? popup.value : { error: popup.error },
      recaps: recaps.ok ? recaps.value : { error: recaps.error },
    };
    return NextResponse.json(body, { status: snapshot.ok && weekly.ok && popup.ok && recaps.ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
