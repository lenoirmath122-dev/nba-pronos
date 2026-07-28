"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/actions/audit";
import { recomputeMatch } from "@/lib/scoring/recompute";
import { advanceWinnerIfDecided } from "@/lib/scoring/advancement";

// Écriture de l'écran Saisie des résultats (SPEC_ECRAN_ADMIN_RESULTATS_V0_1
// §3). AUCUNE policy RLS d'INSERT n'existe sur `matches` (même trouvaille
// que `series` au lot 1, admin-competitions.ts) : session admin
// re-vérifiée (getServerClient + is_admin()) PUIS tout le reste en
// service_role — même patron que `createCompetition`.

export type ActionResult = { success: true } | { success: false; error: string };

const RESULTS_PATH = "/admin/competitions/results";

function revalidateAffectedScreens() {
  revalidatePath(RESULTS_PATH);
  revalidatePath("/bracket");
  revalidatePath("/leaderboard");
  revalidatePath("/play/matches");
  revalidatePath("/play/my-predictions");
  revalidatePath("/home");
}

export async function createMatch(input: {
  seriesId: string;
  homeTeamId: string;
  scheduledAt: string | null;
}): Promise<ActionResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, error: "Réservé aux admins." };

  const service = getServiceClient();

  const { data: series } = await service
    .from("series")
    .select("id, competition_id, team1_id, team2_id, official_status")
    .eq("id", input.seriesId)
    .single<{
      id: string;
      competition_id: string;
      team1_id: string | null;
      team2_id: string | null;
      official_status: string;
    }>();
  if (!series) return { success: false, error: "Série introuvable." };
  if (!series.team1_id || !series.team2_id) {
    return { success: false, error: "Les 2 équipes de cette série ne sont pas encore connues." };
  }
  if (series.official_status === "FINISHED" || series.official_status === "CANCELLED") {
    return { success: false, error: "Cette série est déjà terminée." };
  }
  if (input.homeTeamId !== series.team1_id && input.homeTeamId !== series.team2_id) {
    return { success: false, error: "Équipe à domicile invalide pour cette série." };
  }
  const awayTeamId = input.homeTeamId === series.team1_id ? series.team2_id : series.team1_id;

  const { count } = await service
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("series_id", input.seriesId);
  const gameNumber = (count ?? 0) + 1;
  if (gameNumber > 7) return { success: false, error: "Une série ne peut pas dépasser 7 matchs." };

  const { data: match, error } = await service
    .from("matches")
    .insert({
      competition_id: series.competition_id,
      series_id: input.seriesId,
      game_number: gameNumber,
      scheduled_at: input.scheduledAt,
      status: "SCHEDULED",
      home_team_id: input.homeTeamId,
      away_team_id: awayTeamId,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !match) return { success: false, error: error?.message ?? "Échec de la création du match." };

  await logAdminAction(supabase, {
    actorUserId: user.id,
    action: "CREATE_MATCH",
    targetType: "match",
    targetId: match.id,
    after: { seriesId: input.seriesId, gameNumber, homeTeamId: input.homeTeamId },
  });

  revalidateAffectedScreens();
  return { success: true };
}

export async function saveMatchResult(input: {
  matchId: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "FINISHED" | "POSTPONED" | "CANCELLED";
  homeScore: number | null;
  awayScore: number | null;
}): Promise<ActionResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, error: "Réservé aux admins." };

  if (input.status === "FINISHED" && (input.homeScore === null || input.awayScore === null)) {
    return { success: false, error: "Le score final est obligatoire pour clore un match." };
  }

  const service = getServiceClient();

  const { data: before } = await service
    .from("matches")
    .select("id, series_id, status, home_score, away_score")
    .eq("id", input.matchId)
    .single<{ id: string; series_id: string; status: string; home_score: number | null; away_score: number | null }>();
  if (!before) return { success: false, error: "Match introuvable." };

  const { error } = await service
    .from("matches")
    .update({ status: input.status, home_score: input.homeScore, away_score: input.awayScore })
    .eq("id", input.matchId);
  if (error) return { success: false, error: error.message };

  await recomputeMatch(input.matchId);
  await advanceWinnerIfDecided(before.series_id);

  await logAdminAction(supabase, {
    actorUserId: user.id,
    action: "SAVE_MATCH_RESULT",
    targetType: "match",
    targetId: input.matchId,
    before: { status: before.status, homeScore: before.home_score, awayScore: before.away_score },
    after: { status: input.status, homeScore: input.homeScore, awayScore: input.awayScore },
  });

  revalidateAffectedScreens();
  return { success: true };
}

function parseOptionalInt(value: FormDataEntryValue | null): number | null {
  const str = String(value ?? "").trim();
  if (str.length === 0) return null;
  const n = Number(str);
  return Number.isFinite(n) ? n : null;
}

/** Variante `<form action={...}>` native — même patron que admin-resolution.ts. */
export async function createMatchFormAction(formData: FormData): Promise<void> {
  const seriesId = String(formData.get("seriesId") ?? "");
  const homeTeamId = String(formData.get("homeTeamId") ?? "");
  const scheduledAtLocal = String(formData.get("scheduledAt") ?? "").trim();
  const scheduledAt = scheduledAtLocal.length > 0 ? new Date(scheduledAtLocal).toISOString() : null;

  const result = await createMatch({ seriesId, homeTeamId, scheduledAt });

  if (!result.success) {
    redirect(`${RESULTS_PATH}?resultsError=${encodeURIComponent(result.error)}&seriesId=${seriesId}`);
  }
  redirect(RESULTS_PATH);
}

/** Variante `<form action={...}>` native — même patron que admin-resolution.ts. */
export async function saveMatchResultFormAction(formData: FormData): Promise<void> {
  const matchId = String(formData.get("matchId") ?? "");
  const status = String(formData.get("status") ?? "SCHEDULED") as
    | "SCHEDULED"
    | "IN_PROGRESS"
    | "FINISHED"
    | "POSTPONED"
    | "CANCELLED";
  const homeScore = parseOptionalInt(formData.get("homeScore"));
  const awayScore = parseOptionalInt(formData.get("awayScore"));

  const result = await saveMatchResult({ matchId, status, homeScore, awayScore });

  if (!result.success) {
    redirect(`${RESULTS_PATH}?resultsError=${encodeURIComponent(result.error)}&matchId=${matchId}`);
  }
  redirect(RESULTS_PATH);
}
