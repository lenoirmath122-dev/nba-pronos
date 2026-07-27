"use server";

import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";
import { computeCandidateTeamIds, type BetSeriesFormat, type CascadeSeriesRow } from "@/lib/queries/bracket-fill";

// Server actions de l'écran Bracket personnel (SPEC_ECRAN_BRACKET_PERSONNEL_V0_1
// §5). RLS (brackets_insert/update, bracket_picks_insert/update — migration #3)
// porte DÉJÀ propriétaire/actif/deadline : ces actions ne réécrivent PAS ces
// gardes, elles ajoutent seulement ce que la RLS ne peut pas exprimer — la
// validité du vainqueur soumis contre les équipes CANDIDATES (dépend d'une
// cascade calculée, pas d'une colonne). Recalculée ici avec EXACTEMENT la même
// fonction pure que la lecture (lib/queries/bracket-fill.ts) — jamais une 2e
// implémentation qui pourrait diverger (leçon retenue d'un bug réel du
// prototype, voir §0 de la spec).

export type ActionResult = { success: true } | { success: false; error: string };

type SupabaseServerClient = Awaited<ReturnType<typeof getServerClient>>;

async function requireUser(supabase: SupabaseServerClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function loadCascadeContext(supabase: SupabaseServerClient, competitionId: string, bracketId: string | null) {
  const { data: seriesData } = await supabase
    .from("series")
    .select("id, round, next_series_id, next_series_slot, team1_id, team2_id")
    .eq("competition_id", competitionId);
  const series = (seriesData ?? []) as CascadeSeriesRow[];

  const { data: picksData } = bracketId
    ? await supabase.from("bracket_picks").select("series_id, predicted_winner_team_id").eq("bracket_id", bracketId)
    : { data: [] as { series_id: string; predicted_winner_team_id: string | null }[] };

  const myWinnerBySeriesId = new Map((picksData ?? []).map((p) => [p.series_id, p.predicted_winner_team_id]));
  return { series, myWinnerBySeriesId };
}

export async function saveBracketPick(input: {
  seriesId: string;
  winnerTeamId: string;
  scoreFormat: BetSeriesFormat | null;
}): Promise<ActionResult> {
  const supabase = await getServerClient();
  const user = await requireUser(supabase);
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const { data: series } = await supabase
    .from("series")
    .select("id, competition_id, round")
    .eq("id", input.seriesId)
    .maybeSingle();
  if (!series) return { success: false, error: "Série introuvable." };

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, type")
    .eq("id", series.competition_id)
    .single();

  // Le bracket du joueur peut ne pas encore exister (1er pick) — créé ici,
  // upsert sur la contrainte unique (user_id, competition_id).
  const { data: bracket, error: bracketError } = await supabase
    .from("brackets")
    .upsert({ user_id: user.id, competition_id: series.competition_id }, { onConflict: "user_id,competition_id" })
    .select("id")
    .single();
  if (bracketError || !bracket) return { success: false, error: "Impossible de créer ton bracket." };

  const { series: allSeries, myWinnerBySeriesId } = await loadCascadeContext(
    supabase,
    series.competition_id,
    bracket.id
  );
  const candidates = computeCandidateTeamIds(allSeries, myWinnerBySeriesId, competition?.type ?? "PLAYOFFS").get(
    input.seriesId
  );

  if (!candidates || candidates.teamAId === null || candidates.teamBId === null) {
    return { success: false, error: "Cette série n'est pas encore sélectionnable." };
  }
  if (input.winnerTeamId !== candidates.teamAId && input.winnerTeamId !== candidates.teamBId) {
    return { success: false, error: "Ce vainqueur ne correspond pas aux équipes de cette série." };
  }

  const scoreFormat = competition?.type === "NBA_CUP" ? null : input.scoreFormat;

  const { error, data } = await supabase
    .from("bracket_picks")
    .upsert(
      {
        competition_id: series.competition_id,
        bracket_id: bracket.id,
        series_id: input.seriesId,
        predicted_winner_team_id: input.winnerTeamId,
        predicted_score_format: scoreFormat,
      },
      { onConflict: "bracket_id,series_id" }
    )
    .select("id");
  if (error || !data || data.length === 0) {
    return { success: false, error: "Impossible d'enregistrer ce pick." };
  }

  revalidatePath("/play/bracket");
  revalidatePath("/bracket");
  revalidatePath("/home");
  return { success: true };
}

export async function validateBracket(): Promise<ActionResult> {
  const supabase = await getServerClient();
  const user = await requireUser(supabase);
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const { data: competition } = await supabase.from("competitions").select("id").eq("status", "ACTIVE").maybeSingle();
  if (!competition) return { success: false, error: "Aucune compétition en cours." };

  // Aucune garde de complétude (§4, acté) : 0/15 à 15/15 accepté.
  const { error, data } = await supabase
    .from("brackets")
    .update({ is_validated: true, validated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("competition_id", competition.id)
    .select("id");
  if (error || !data || data.length === 0) {
    return { success: false, error: "Impossible de valider ton bracket." };
  }

  revalidatePath("/play/bracket");
  return { success: true };
}
