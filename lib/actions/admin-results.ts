"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/actions/audit";
import { recomputeMatch } from "@/lib/scoring/recompute";
import { advanceWinnerIfDecided } from "@/lib/scoring/advancement";
import { parisLocalToUtcIso } from "@/lib/dates/paris";
import { toClientError } from "@/lib/actions/errors";

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
  revalidatePath("/play");
  revalidatePath("/play/results");
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
  if (error || !match) return { success: false, error: error ? toClientError("createMatch", error) : "Échec de la création du match." };

  await recomputeBracketDeadline(service, series.competition_id);

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

// Deadline de remplissage du bracket (BACKLOG_V1.md — trouvé en creusant
// pourquoi le bracket ne se comparait jamais entre joueurs, 30/07/2026) :
// « le début du premier match qui commence dans la compétition » (définition
// de l'utilisateur, plus simple que "1er tour uniquement" et strictement
// équivalente en pratique — un match d'un tour ultérieur ne peut de toute
// façon pas être créé avant que le tour précédent y ait avancé les 2
// équipes, cf. la garde plus haut dans createMatch).
//
// Recalculée en ENTIER (jamais "si plus tôt que l'actuel") à chaque création
// de match : un admin peut saisir les matchs dans n'importe quel ordre, donc
// seul un recalcul complet du minimum reste exact à coup sûr.
async function recomputeBracketDeadline(
  service: ReturnType<typeof getServiceClient>,
  competitionId: string
): Promise<void> {
  const { data: earliest } = await service
    .from("matches")
    .select("scheduled_at")
    .eq("competition_id", competitionId)
    .not("scheduled_at", "is", null)
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ scheduled_at: string }>();

  await service
    .from("competitions")
    .update({ bracket_deadline: earliest?.scheduled_at ?? null })
    .eq("id", competitionId);
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
  if (error) return { success: false, error: toClientError("saveMatchResult", error) };

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

// Suppression manuelle d'un match (17/08/2026, demandé par l'utilisateur —
// matchs ajoutés avec une heure déjà passée par erreur de fuseau, aucun
// moyen de les retirer jusqu'ici). Même patron d'auth/écriture que
// createMatch/saveMatchResult ci-dessus. JAMAIS de cascade silencieuse :
// `match_predictions`/`bets` référencent `matches` SANS `ON DELETE CASCADE`
// (migration initiale) — une suppression bloquée par cette contrainte
// (code Postgres 23503) est traduite en message clair plutôt que de perdre
// des pronostics/paris de joueurs sans le dire.
export async function deleteMatch(matchId: string): Promise<ActionResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, error: "Réservé aux admins." };

  const service = getServiceClient();

  const { data: before } = await service
    .from("matches")
    .select("id, competition_id, series_id, game_number, home_team_id, away_team_id, scheduled_at, status")
    .eq("id", matchId)
    .single<{
      id: string;
      competition_id: string;
      series_id: string;
      game_number: number;
      home_team_id: string | null;
      away_team_id: string | null;
      scheduled_at: string | null;
      status: string;
    }>();
  if (!before) return { success: false, error: "Match introuvable." };

  const { error } = await service.from("matches").delete().eq("id", matchId);
  if (error) {
    if (error.code === "23503") {
      return { success: false, error: "Impossible : des pronostics ou paris existent déjà sur ce match." };
    }
    return { success: false, error: toClientError("deleteMatch", error) };
  }

  await recomputeBracketDeadline(service, before.competition_id);

  await logAdminAction(supabase, {
    actorUserId: user.id,
    action: "DELETE_MATCH",
    targetType: "match",
    targetId: matchId,
    before: {
      seriesId: before.series_id,
      gameNumber: before.game_number,
      homeTeamId: before.home_team_id,
      awayTeamId: before.away_team_id,
      scheduledAt: before.scheduled_at,
      status: before.status,
    },
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

// Bug trouvé le 30/07/2026 (compétition de test créée avec 2h de décalage) :
// <input type="datetime-local"> renvoie une heure SANS fuseau — l'admin la
// saisit en heure de Paris, mais `new Date(str).toISOString()`
// l'interprétait selon le fuseau du SERVEUR (Vercel, UTC), pas celui de
// l'admin. Conversion via lib/dates/paris.ts (parisLocalToUtcIso), pas de
// 2e implémentation ici.

/** Variante `<form action={...}>` native — même patron que admin-resolution.ts. */
export async function createMatchFormAction(formData: FormData): Promise<void> {
  const seriesId = String(formData.get("seriesId") ?? "");
  const homeTeamId = String(formData.get("homeTeamId") ?? "");
  const scheduledAtLocal = String(formData.get("scheduledAt") ?? "").trim();
  const scheduledAt = scheduledAtLocal.length > 0 ? parisLocalToUtcIso(scheduledAtLocal) : null;

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
