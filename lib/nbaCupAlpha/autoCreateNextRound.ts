import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { parisLocalToUtcIso } from "@/lib/dates/paris";

// Automatise scripts/nba-cup-create-match.mjs (étape 3 du runbook "NBA Cup
// — Alpha Potes", GAPS_OUVERTS.md) pour les demies + la finale UNIQUEMENT --
// les 4 quarts sont déjà créés manuellement (28/08/2026), rien à faire pour
// eux ici. Contrairement aux quarts (duels choisis librement par
// l'utilisateur au moment de créer la compétition), les 3 matchs ci-dessous
// sont FIXES et déjà choisis (28/08/2026, voir la table dans
// GAPS_OUVERTS.md) -- possible par anticipation car chaque quart/demi
// emprunte un vrai match déjà joué, donc son vainqueur est déterministe dès
// que la révélation du tour précédent tourne (autoReveal.ts). Repris tel
// quel, jamais recalculé ici.
//
// Horaires (19h/21h le 22/09 pour les 2 demies, 20h le 23/09 pour la
// finale) déduits du calendrier retenu (GAPS_OUVERTS.md) en respectant
// l'ordre déjà utilisé pour les quarts (Celtics-Knicks/Lakers-Warriors à
// 19h/21h le 20/09, donc Demi 1 Celtics/Lakers à 19h ; Nuggets-Thunder/
// Bucks-76ers à 19h/21h le 21/09, donc Demi 2 Nuggets/Bucks à 21h) -- pas
// une heure explicitement assignée par écrit ailleurs, à confirmer.
//
// NE PAS réutiliser pour la bêta -- mécanisme temporaire propre à l'emprunt
// alpha (même mise en garde que autoReveal.ts / nba-cup-create-match.mjs).

const NEXT_ROUND_MATCHES: {
  seriesId: string;
  realGameId: string;
  scheduledAtParisLocal: string; // "YYYY-MM-DDTHH:mm", heure murale Paris
  label: string;
}[] = [
  {
    seriesId: "ec46a1e1-97a2-4b2a-8417-6e29ab45955e",
    realGameId: "0022400918",
    scheduledAtParisLocal: "2026-09-22T19:00",
    label: "Demi 1 (Celtics/Lakers)",
  },
  {
    seriesId: "221f571f-7c57-414a-8659-43cf4c3017f6",
    realGameId: "0022401057",
    scheduledAtParisLocal: "2026-09-22T21:00",
    label: "Demi 2 (Nuggets/Bucks)",
  },
  {
    seriesId: "aecc3c23-dcb3-49fb-b35f-d69f15f88277",
    realGameId: "0022400866",
    scheduledAtParisLocal: "2026-09-23T20:00",
    label: "Finale (Celtics/Nuggets)",
  },
];

type SupabaseServiceClient = ReturnType<typeof getServiceClient>;

type SeriesRow = {
  id: string;
  competition_id: string;
  team1_id: string | null;
  team2_id: string | null;
  official_status: string;
};

export type CreatedNextRoundMatch = { seriesId: string; matchId: string; label: string; scheduledAt: string };
export type SkippedNextRoundMatch = { seriesId: string; label: string; reason: string };

export type AutoCreateNextRoundResult = {
  created: CreatedNextRoundMatch[];
  skipped: SkippedNextRoundMatch[];
};

/** Idempotent -- ne fait rien tant que les 2 équipes de la série ne sont
 *  pas connues, et ne recrée jamais un match déjà créé. Sans effet de bord
 *  à être appelée à chaque passage du cron même quand rien n'est dû. */
export async function autoCreateDueNextRoundMatches(): Promise<AutoCreateNextRoundResult> {
  const supabase = getServiceClient();
  const result: AutoCreateNextRoundResult = { created: [], skipped: [] };

  for (const entry of NEXT_ROUND_MATCHES) {
    await createOneIfDue(supabase, entry, result);
  }

  return result;
}

async function createOneIfDue(
  supabase: SupabaseServiceClient,
  entry: (typeof NEXT_ROUND_MATCHES)[number],
  result: AutoCreateNextRoundResult
): Promise<void> {
  const { data: series } = await supabase
    .from("series")
    .select("id, competition_id, team1_id, team2_id, official_status")
    .eq("id", entry.seriesId)
    .maybeSingle<SeriesRow>();
  if (!series) {
    result.skipped.push({ seriesId: entry.seriesId, label: entry.label, reason: "série introuvable" });
    return;
  }
  if (!series.team1_id || !series.team2_id) {
    result.skipped.push({
      seriesId: entry.seriesId,
      label: entry.label,
      reason: "équipes pas encore connues (tour précédent pas encore révélé)",
    });
    return;
  }
  if (series.official_status === "FINISHED" || series.official_status === "CANCELLED") {
    result.skipped.push({ seriesId: entry.seriesId, label: entry.label, reason: "série déjà terminée" });
    return;
  }

  const { count: existingCount } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("series_id", entry.seriesId);
  if ((existingCount ?? 0) > 0) {
    result.skipped.push({ seriesId: entry.seriesId, label: entry.label, reason: "match déjà créé" });
    return;
  }

  const { data: realGame } = await supabase.from("stats_matchs").select("game_id").eq("game_id", entry.realGameId).maybeSingle();
  if (!realGame) {
    result.skipped.push({ seriesId: entry.seriesId, label: entry.label, reason: `game_id ${entry.realGameId} introuvable dans stats_matchs` });
    return;
  }

  const scheduledAt = parisLocalToUtcIso(entry.scheduledAtParisLocal);

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .insert({
      competition_id: series.competition_id,
      series_id: entry.seriesId,
      game_number: 1,
      scheduled_at: scheduledAt,
      status: "SCHEDULED",
      home_team_id: series.team1_id,
      away_team_id: series.team2_id,
    })
    .select("id")
    .single();
  if (matchError || !match) {
    result.skipped.push({ seriesId: entry.seriesId, label: entry.label, reason: `création échouée : ${matchError?.message}` });
    return;
  }

  const { error: mappingError } = await supabase.from("entity_mappings").insert({
    entity_type: "MATCH",
    internal_id: match.id,
    source_type: "NBA_API",
    source_ref: entry.realGameId,
    status: "CONFIRMED",
    confirmed_at: new Date().toISOString(),
  });
  if (mappingError) {
    result.skipped.push({ seriesId: entry.seriesId, label: entry.label, reason: `entity_mappings échoué : ${mappingError.message}` });
    return;
  }

  await recomputeBracketDeadline(supabase, series.competition_id);

  result.created.push({ seriesId: entry.seriesId, matchId: match.id, label: entry.label, scheduledAt });
}

async function recomputeBracketDeadline(supabase: SupabaseServiceClient, competitionId: string): Promise<void> {
  const { data: earliest } = await supabase
    .from("matches")
    .select("scheduled_at")
    .eq("competition_id", competitionId)
    .not("scheduled_at", "is", null)
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  await supabase
    .from("competitions")
    .update({ bracket_deadline: earliest?.scheduled_at ?? null })
    .eq("id", competitionId);
}
