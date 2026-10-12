import "server-only";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { recapBoundaryIso } from "@/lib/recaps/period";
import { weekEndFor } from "@/lib/weekly/standings";
import { AUTO_GENERATION_MAX_AGE_MS, STALE_GENERATING_MS } from "./config";
import { runWeeklyPopupGeneration } from "./generate";
import type { GenerationTrigger } from "./types";

// Garantit qu'une semaine figée a un brouillon de popup (plan §4.1, déc. 20).
// Appelé à CHAQUE passage du cron (8h, 9h, 10h UTC), pas seulement quand le
// figement vient d'avoir lieu : « semaine figée sans brouillon » est l'état
// qu'on cherche, et le passage « déjà figé » est le cas normal des cron 2 et 3.
//
// Partie synchrone (avant la réponse) : lecture et RÉSERVATION de la ligne.
// Génération (LLM, plusieurs dizaines de secondes) : dans `after()`, après la
// réponse, avec le budget restant du `maxDuration` de la route.

type Client = ReturnType<typeof getServiceClient>;

const MIGRATION_HINT = "migration 20261013090000 poussée ?";

function fail(context: string, error: { message: string }): never {
  throw new Error(`${context} (${MIGRATION_HINT}) : ${error.message}`);
}

/**
 * Filtre `.or()` : `.eq("generation_id", null)` enverrait `eq.null`, un uuid
 * invalide que PostgREST rejette (ligne jamais reprise, cron en 500).
 */
const generationIs = (id: string | null): string =>
  id === null ? "generation_id.is.null" : `generation_id.eq.${id}`;

export type EnsureResult = {
  action: "scheduled" | "none";
  weekEnd: string;
  popupId?: string;
  reason?:
    | "aucune compétition active"
    | "popup désactivée"
    | "semaine non figée"
    | "déjà générée"
    | "génération en cours"
    | "semaine trop ancienne"
    | "réservée par un autre passage";
};

/** Suffixe du message de « Figer la semaine » (sans donnée de joueur). */
export function ensureNote(result: EnsureResult): string {
  if (result.action === "scheduled") return " Popup : génération lancée.";
  if (result.reason === "déjà générée") return " Popup : déjà générée.";
  if (result.reason === "génération en cours") return " Popup : génération déjà en cours.";
  return "";
}

export type EnsureDeps = {
  client?: Client;
  /** Défaut : `after` de next/server (hors requête, il lève : injecter en test). */
  schedule?: (task: () => Promise<void>) => void;
  newId?: () => string;
  run?: typeof runWeeklyPopupGeneration;
};

export async function ensureWeeklyPopupDraft(
  nowMs: number,
  opts: {
    trigger: Extract<GenerationTrigger, "CRON" | "ADMIN_FREEZE" | "ADMIN_GENERATE">;
    deadlineMs: number;
    deps?: EnsureDeps;
  },
): Promise<EnsureResult> {
  const deps = opts.deps ?? {};
  const supabase = deps.client ?? getServiceClient();
  const schedule = deps.schedule ?? ((task: () => Promise<void>) => after(task));
  const newId = deps.newId ?? randomUUID;
  const run = deps.run ?? runWeeklyPopupGeneration;
  const weekEnd = weekEndFor(nowMs);
  const none = (reason: NonNullable<EnsureResult["reason"]>, popupId?: string): EnsureResult => ({
    action: "none",
    weekEnd,
    popupId,
    reason,
  });

  const { data: competition, error: competitionError } = await supabase
    .from("competitions")
    .select("id, weekly_ranking, weekly_popup")
    .eq("status", "ACTIVE")
    .maybeSingle<{ id: string; weekly_ranking: boolean; weekly_popup: boolean }>();
  if (competitionError) fail("Lecture de la compétition", competitionError);
  if (!competition) return none("aucune compétition active");
  if (!competition.weekly_ranking || !competition.weekly_popup) return none("popup désactivée");

  const { data: frozen, error: frozenError } = await supabase
    .from("weekly_rankings")
    .select("week_end_date")
    .eq("competition_id", competition.id)
    .eq("week_end_date", weekEnd)
    .maybeSingle();
  if (frozenError) fail("Lecture de la semaine figée", frozenError);
  if (!frozen) return none("semaine non figée");

  const { data: existing, error: existingError } = await supabase
    .from("weekly_popups")
    .select("id, status, generation_id, generation_started_at")
    .eq("competition_id", competition.id)
    .eq("week_end_date", weekEnd)
    .maybeSingle<{
      id: string;
      status: string;
      generation_id: string | null;
      generation_started_at: string | null;
    }>();
  if (existingError) fail("Lecture du brouillon de popup", existingError);

  const staleBefore = new Date(nowMs - STALE_GENERATING_MS).toISOString();
  const isStaleGenerating =
    existing?.status === "GENERATING" &&
    (existing.generation_started_at === null ||
      Date.parse(existing.generation_started_at) < Date.parse(staleBefore));

  // Semaine trop ancienne : le cron ne génère plus tout seul (un figement
  // admin tardif, lui, passe : la garde ne s'applique qu'au cron).
  const age = nowMs - Date.parse(recapBoundaryIso(weekEnd));
  if (opts.trigger === "CRON" && age > AUTO_GENERATION_MAX_AGE_MS) {
    if (existing && isStaleGenerating) {
      await supabase
        .from("weekly_popups")
        .update({ status: "DOUBTFUL", doubt_code: "stale", doubt_detail: "semaine trop ancienne" })
        .eq("id", existing.id)
        .eq("status", "GENERATING")
        .or(generationIs(existing.generation_id));
    }
    return none("semaine trop ancienne", existing?.id);
  }

  const generationId = newId();
  const startedAt = new Date(nowMs).toISOString();
  let popupId: string;

  if (!existing) {
    const { data, error } = await supabase
      .from("weekly_popups")
      .upsert(
        {
          competition_id: competition.id,
          week_end_date: weekEnd,
          kind: "LLM",
          status: "GENERATING",
          generation_id: generationId,
          generation_started_at: startedAt,
        },
        { onConflict: "competition_id,week_end_date", ignoreDuplicates: true },
      )
      .select("id");
    if (error) fail("Réservation du brouillon de popup", error);
    if (!data || data.length === 0) return none("réservée par un autre passage");
    popupId = String(data[0].id);
  } else if (isStaleGenerating) {
    const { data, error } = await supabase
      .from("weekly_popups")
      .update({ generation_id: generationId, generation_started_at: startedAt, admin_notified_at: null })
      .eq("id", existing.id)
      .eq("status", "GENERATING")
      .or(generationIs(existing.generation_id))
      .select("id");
    if (error) fail("Reprise du brouillon de popup", error);
    if (!data || data.length === 0) return none("réservée par un autre passage", existing.id);
    popupId = existing.id;
  } else if (existing.status === "GENERATING") {
    return none("génération en cours", existing.id);
  } else {
    // READY, DOUBTFUL, PUBLISHED, SKIPPED, RETRACTED : rien à faire tout seul.
    return none("déjà générée", existing.id);
  }

  schedule(async () => {
    await run(popupId, generationId, { deadlineMs: opts.deadlineMs, trigger: opts.trigger });
  });
  return { action: "scheduled", weekEnd, popupId };
}

/**
 * Réserve une régénération (action admin, PR 4) : READY, DOUBTFUL ou SKIPPED,
 * ou GENERATING périmé, repassent à GENERATING avec un nouveau `generation_id`.
 * Jamais une popup PUBLISHED ou RETRACTED.
 */
export async function reserveRegeneration(
  popupId: string,
  nowMs: number,
  deps: { client?: Client; newId?: () => string } = {},
): Promise<{ ok: true; generationId: string } | { ok: false; reason: string }> {
  const supabase = deps.client ?? getServiceClient();
  const generationId = (deps.newId ?? randomUUID)();
  const startedAt = new Date(nowMs).toISOString();
  const patch = { status: "GENERATING", generation_id: generationId, generation_started_at: startedAt, admin_notified_at: null };

  const direct = await supabase
    .from("weekly_popups")
    .update(patch)
    .eq("id", popupId)
    .in("status", ["READY", "DOUBTFUL", "SKIPPED"])
    .select("id");
  if (direct.error) fail("Réservation de la régénération", direct.error);
  if (direct.data && direct.data.length > 0) return { ok: true, generationId };

  const stale = await supabase
    .from("weekly_popups")
    .update(patch)
    .eq("id", popupId)
    .eq("status", "GENERATING")
    .or(
      `generation_started_at.is.null,generation_started_at.lt.${new Date(nowMs - STALE_GENERATING_MS).toISOString()}`,
    )
    .select("id");
  if (stale.error) fail("Réservation de la régénération", stale.error);
  if (stale.data && stale.data.length > 0) return { ok: true, generationId };

  return { ok: false, reason: "génération en cours, publiée ou retirée" };
}
