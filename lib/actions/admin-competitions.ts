"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/actions/audit";
import { assignRanks } from "@/lib/scoring/ranking";
import { computeSuperlatives } from "@/lib/scoring/superlatives";
import { toClientError } from "@/lib/actions/errors";
import { isCompetitionType, type CompetitionType } from "@/lib/competitions/types";
import { runLeaderboardSnapshot } from "@/lib/snapshots/leaderboardSnapshot";
import { runWeeklyFreeze, type WeeklyFreezeResult } from "@/lib/weekly/freezeWeek";
import { runWeeklyRecapSend, type WeeklySendResult } from "@/lib/weekly/sendWeeklyRecap";

// Écriture de la Gestion des compétitions (SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1
// §4). competitions/competition_secrets : session admin (RLS
// competitions_insert/secrets_all, is_admin(), migration #3 — déjà en
// place). `series` : AUCUNE policy RLS d'INSERT n'existe (trouvé au
// pré-vol — seules series_select et series_update existent) — traité
// comme une écriture admin-système (T6a §5, Option A, même famille que
// recomputeCompetition/writeSeriesOutcome) : service_role, APRÈS
// re-vérification explicite de is_admin() en session, plutôt qu'une
// nouvelle migration RLS pour un cas d'usage rare (quelques fois par
// saison).

export type ActionResult = { success: true } | { success: false; error: string };

// Topologie FIXE du bracket Playoffs (§0/§5 de la spec) — 8 affiches
// ROUND_1 dans l'ordre E1..E4, W1..W4, jamais choisie par l'admin.
const ROUND1_SLOTS = ["e1", "e2", "e3", "e4", "w1", "w2", "w3", "w4"] as const;

// Topologie FIXE du mini-bracket NBA Cup (correctif post-validation
// SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1.md §3/§8, session du 31/07/2026) — 4
// quarts choisis LIBREMENT par l'admin (le schéma T1 ne porte aucune
// conférence pour la Cup, `series.conference` NULL sur toute la phase,
// contrairement aux Playoffs) → 2 demies → 1 finale, même cascade
// bottom-up que createPlayoffBracket, sans logique de conférence.
const CUP_QUARTER_SLOTS = ["q1", "q2", "q3", "q4"] as const;

export async function createCompetition(input: {
  name: string;
  type: CompetitionType;
  round1Matchups?: [string, string][]; // 8 paires, ordre ROUND1_SLOTS — Playoffs uniquement
  cupQuarterMatchups?: [string, string][]; // 4 paires, ordre CUP_QUARTER_SLOTS — NBA Cup uniquement
  weeklyRanking?: boolean; // classement hebdomadaire (un champion par semaine), faux par défaut
}): Promise<ActionResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, error: "Réservé aux admins." };

  const name = input.name.trim();
  if (name.length === 0) return { success: false, error: "Le nom est obligatoire." };

  const { count: activeCount } = await supabase
    .from("competitions")
    .select("id", { count: "exact", head: true })
    .eq("status", "ACTIVE");
  if ((activeCount ?? 0) > 0) {
    return { success: false, error: "Une compétition est déjà active — clôture-la avant d'en créer une nouvelle." };
  }

  if (input.type === "PLAYOFFS") {
    const matchups = input.round1Matchups;
    if (!matchups || matchups.length !== 8) {
      return { success: false, error: "Les 8 affiches du 1er tour sont obligatoires pour les Playoffs." };
    }
    const allTeamIds = matchups.flat();
    if (new Set(allTeamIds).size !== 16) {
      return { success: false, error: "Chaque équipe ne peut être sélectionnée qu'une seule fois." };
    }

    const { data: teamsData } = await supabase.from("teams").select("id, conference").in("id", allTeamIds);
    const teamConferenceById = new Map((teamsData ?? []).map((t) => [t.id as string, t.conference as "EAST" | "WEST"]));
    if (teamConferenceById.size !== 16) {
      return { success: false, error: "Une équipe sélectionnée est introuvable." };
    }
    for (let i = 0; i < ROUND1_SLOTS.length; i++) {
      const expectedConference = ROUND1_SLOTS[i].startsWith("e") ? "EAST" : "WEST";
      const [teamA, teamB] = matchups[i];
      if (teamConferenceById.get(teamA) !== expectedConference || teamConferenceById.get(teamB) !== expectedConference) {
        return { success: false, error: `Les 2 équipes de l'affiche ${ROUND1_SLOTS[i].toUpperCase()} doivent être en conférence ${expectedConference === "EAST" ? "Est" : "Ouest"}.` };
      }
    }
  }

  if (input.type === "NBA_CUP") {
    const matchups = input.cupQuarterMatchups;
    if (!matchups || matchups.length !== 4) {
      return { success: false, error: "Les 4 affiches des quarts sont obligatoires pour la NBA Cup." };
    }
    const allTeamIds = matchups.flat();
    if (new Set(allTeamIds).size !== 8) {
      return { success: false, error: "Chaque équipe ne peut être sélectionnée qu'une seule fois." };
    }
    const { count: teamsCount } = await supabase
      .from("teams")
      .select("id", { count: "exact", head: true })
      .in("id", allTeamIds);
    if ((teamsCount ?? 0) !== 8) {
      return { success: false, error: "Une équipe sélectionnée est introuvable." };
    }
  }

  const { data: competition, error: compErr } = await supabase
    .from("competitions")
    // `weekly_ranking` n'est écrit que s'il est vrai : la création reste
    // possible tant que la migration 20261012090000 n'est pas poussée.
    .insert({
      name,
      type: input.type,
      status: "ACTIVE",
      bracket_deadline: null,
      ...(input.weeklyRanking ? { weekly_ranking: true } : {}),
    })
    .select("id")
    .single<{ id: string }>();
  if (compErr || !competition) return { success: false, error: compErr ? toClientError("createCompetition", compErr) : "Échec de la création." };

  const joinCode = randomUUID().slice(0, 8).toUpperCase();
  const { error: secretErr } = await supabase
    .from("competition_secrets")
    .insert({ competition_id: competition.id, join_code: joinCode });
  if (secretErr) return { success: false, error: toClientError("createCompetition/secret", secretErr) };

  if (input.type === "PLAYOFFS" && input.round1Matchups) {
    try {
      await createPlayoffBracket(competition.id, input.round1Matchups);
    } catch (error) {
      return { success: false, error: toClientError("createCompetition/playoffBracket", error instanceof Error ? error : { message: String(error) }) };
    }
  }

  if (input.type === "NBA_CUP" && input.cupQuarterMatchups) {
    try {
      await createCupBracket(competition.id, input.cupQuarterMatchups);
    } catch (error) {
      return { success: false, error: toClientError("createCompetition/cupBracket", error instanceof Error ? error : { message: String(error) }) };
    }
  }

  await logAdminAction(supabase, {
    actorUserId: user.id,
    action: "CREATE_COMPETITION",
    targetType: "competition",
    targetId: competition.id,
    after: { name, type: input.type, weeklyRanking: input.weeklyRanking === true },
  });

  return { success: true };
}

async function createPlayoffBracket(competitionId: string, matchups: [string, string][]): Promise<void> {
  const supabase = getServiceClient();

  const insertSeries = async (rows: Record<string, unknown>[]) => {
    const { data, error } = await supabase.from("series").insert(rows).select("id");
    if (error) throw new Error(`Création du bracket échouée : ${error.message}`);
    return (data ?? []) as { id: string }[];
  };

  // Bottom-up : NBA_FINALS -> CONF_FINALS -> CONF_SEMIS -> ROUND_1, pour
  // toujours connaître l'id de la série AVAL avant de créer la série AMONT
  // (next_series_id la référence).
  const [finalsRow] = await insertSeries([
    { competition_id: competitionId, round: "NBA_FINALS", conference: null, slot_index: 0 },
  ]);

  const [efRow, wfRow] = await insertSeries([
    { competition_id: competitionId, round: "CONF_FINALS", conference: "EAST", slot_index: 0, next_series_id: finalsRow.id, next_series_slot: 1 },
    { competition_id: competitionId, round: "CONF_FINALS", conference: "WEST", slot_index: 1, next_series_id: finalsRow.id, next_series_slot: 2 },
  ]);

  const [es1Row, es2Row, ws1Row, ws2Row] = await insertSeries([
    { competition_id: competitionId, round: "CONF_SEMIS", conference: "EAST", slot_index: 0, next_series_id: efRow.id, next_series_slot: 1 },
    { competition_id: competitionId, round: "CONF_SEMIS", conference: "EAST", slot_index: 1, next_series_id: efRow.id, next_series_slot: 2 },
    { competition_id: competitionId, round: "CONF_SEMIS", conference: "WEST", slot_index: 2, next_series_id: wfRow.id, next_series_slot: 1 },
    { competition_id: competitionId, round: "CONF_SEMIS", conference: "WEST", slot_index: 3, next_series_id: wfRow.id, next_series_slot: 2 },
  ]);

  const semisBySlot = [es1Row, es1Row, es2Row, es2Row, ws1Row, ws1Row, ws2Row, ws2Row];
  const nextSlotBySlot = [1, 2, 1, 2, 1, 2, 1, 2];
  const conferenceBySlot = ["EAST", "EAST", "EAST", "EAST", "WEST", "WEST", "WEST", "WEST"];

  await insertSeries(
    ROUND1_SLOTS.map((_, i) => ({
      competition_id: competitionId,
      round: "ROUND_1",
      conference: conferenceBySlot[i],
      slot_index: i,
      team1_id: matchups[i][0],
      team2_id: matchups[i][1],
      next_series_id: semisBySlot[i].id,
      next_series_slot: nextSlotBySlot[i],
    }))
  );
}

async function createCupBracket(competitionId: string, matchups: [string, string][]): Promise<void> {
  const supabase = getServiceClient();

  const insertSeries = async (rows: Record<string, unknown>[]) => {
    const { data, error } = await supabase.from("series").insert(rows).select("id");
    if (error) throw new Error(`Création du bracket échouée : ${error.message}`);
    return (data ?? []) as { id: string }[];
  };

  // Bottom-up, même patron que createPlayoffBracket, sans conférence
  // (série.conference NULL sur toute la Cup, §0 du correctif de spec).
  const [finalRow] = await insertSeries([
    { competition_id: competitionId, round: "CUP_FINAL", conference: null, slot_index: 0 },
  ]);

  const [semi0Row, semi1Row] = await insertSeries([
    { competition_id: competitionId, round: "CUP_SEMIS", conference: null, slot_index: 0, next_series_id: finalRow.id, next_series_slot: 1 },
    { competition_id: competitionId, round: "CUP_SEMIS", conference: null, slot_index: 1, next_series_id: finalRow.id, next_series_slot: 2 },
  ]);

  const semisBySlot = [semi0Row, semi0Row, semi1Row, semi1Row];
  const nextSlotBySlot = [1, 2, 1, 2];

  await insertSeries(
    CUP_QUARTER_SLOTS.map((_, i) => ({
      competition_id: competitionId,
      round: "CUP_QUARTERS",
      conference: null,
      slot_index: i,
      team1_id: matchups[i][0],
      team2_id: matchups[i][1],
      next_series_id: semisBySlot[i].id,
      next_series_slot: nextSlotBySlot[i],
    }))
  );
}

/**
 * Variante `<form action={...}>` NATIVE : FormData brut, appel de
 * l'action, puis REDIRECTION en cas d'erreur (le succès redirige déjà
 * depuis createCompetition). Même patron que les lots admin précédents.
 */
export async function createCompetitionFormAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "");
  const rawType = formData.get("type");
  if (!isCompetitionType(rawType)) {
    redirect(`/admin/competitions/new?competitionError=${encodeURIComponent("Type de compétition invalide.")}`);
  }
  const type: CompetitionType = rawType;

  let round1Matchups: [string, string][] | undefined;
  if (type === "PLAYOFFS") {
    round1Matchups = ROUND1_SLOTS.map((slot) => {
      const a = String(formData.get(`matchup_${slot}_a`) ?? "");
      const b = String(formData.get(`matchup_${slot}_b`) ?? "");
      return [a, b] as [string, string];
    });
  }

  let cupQuarterMatchups: [string, string][] | undefined;
  if (type === "NBA_CUP") {
    cupQuarterMatchups = CUP_QUARTER_SLOTS.map((slot) => {
      const a = String(formData.get(`cup_${slot}_a`) ?? "");
      const b = String(formData.get(`cup_${slot}_b`) ?? "");
      return [a, b] as [string, string];
    });
  }

  const weeklyRanking = formData.get("weekly_ranking") === "on";

  const result = await createCompetition({ name, type, round1Matchups, cupQuarterMatchups, weeklyRanking });

  if (!result.success) {
    redirect(`/admin/competitions/new?competitionError=${encodeURIComponent(result.error)}`);
  }
  redirect("/admin/competitions");
}

type ArchiveScoreRow = {
  user_id: string;
  total_points: number;
  matches_points: number;
  margin_bonus_points: number;
  bracket_points: number;
  bets_points: number;
  correct_match_winners: number;
  exact_margins: number;
};

// Clôture et archivage (SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1 §9, lot 3/3) —
// décision produite 0.2.9/decisions_multi_competitions_historique §3 :
// 1. instantané FIGÉ du classement final dans competition_archives (RLS
//    archives_insert = is_admin(), session admin normale, pas de
//    service_role) ; 2. `status` passe à ARCHIVED — ça SEUL libère le slot
//    `uniq_one_active_competition`, AUCUNE donnée n'est supprimée (series/
//    matches/predictions/brackets/bets restent en base, competition_id les
//    rattache pour toujours — nécessaire à un futur historique joueur,
//    GAPS_OUVERTS.md). Même départage de rang que le classement live
//    (lib/scoring/ranking.ts) : l'archive doit geler exactement ce que le
//    classement affichait juste avant la clôture.
export async function closeCompetition(competitionId: string): Promise<ActionResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, error: "Réservé aux admins." };

  const { data: scores } = await supabase
    .from("user_scores")
    .select(
      "user_id, total_points, matches_points, margin_bonus_points, bracket_points, bets_points, correct_match_winners, exact_margins"
    )
    .eq("competition_id", competitionId);
  const scoreRows = (scores ?? []) as ArchiveScoreRow[];

  if (scoreRows.length > 0) {
    const userIds = scoreRows.map((row) => row.user_id);
    const { data: profiles } = await supabase.from("users").select("id, pseudo").in("id", userIds);
    const pseudoById = new Map((profiles ?? []).map((p) => [p.id as string, p.pseudo as string]));
    const ranks = assignRanks(scoreRows);

    const archiveRows = scoreRows.map((row) => ({
      competition_id: competitionId,
      user_id: row.user_id,
      pseudo_snapshot: pseudoById.get(row.user_id) ?? "—",
      rank: ranks.get(row.user_id)!,
      total_points: row.total_points,
      matches_points: row.matches_points,
      margin_bonus_points: row.margin_bonus_points,
      bracket_points: row.bracket_points,
      bets_points: row.bets_points,
      correct_match_winners: row.correct_match_winners,
      exact_margins: row.exact_margins,
    }));

    const { error: archiveErr } = await supabase.from("competition_archives").insert(archiveRows);
    if (archiveErr) return { success: false, error: toClientError("closeCompetition/archive", archiveErr) };

    // Superlatifs (BACKLOG_V1.md « Fun / esprit ligue entre potes »), figés
    // dans la MÊME clôture que l'archive — jamais recalculés après coup.
    const superlativeRows = await computeSuperlatives(supabase, competitionId, scoreRows, ranks, pseudoById);
    if (superlativeRows.length > 0) {
      const { error: superlativesErr } = await supabase
        .from("competition_superlatives")
        .insert(superlativeRows);
      if (superlativesErr) return { success: false, error: toClientError("closeCompetition/superlatives", superlativesErr) };
    }
  }

  const { data: closed, error: closeErr } = await supabase
    .from("competitions")
    // archived_at : colonne posée dès le schéma initial (T1) mais jamais
    // écrite jusqu'ici (trouvé en construisant l'écran Historique, qui en a
    // besoin pour trier/dater les compétitions closes) — corrigé au passage.
    .update({ status: "ARCHIVED", archived_at: new Date().toISOString() })
    .eq("id", competitionId)
    .eq("status", "ACTIVE")
    .select("id")
    .maybeSingle();
  if (closeErr) return { success: false, error: toClientError("closeCompetition", closeErr) };
  if (!closed) return { success: false, error: "Cette compétition est déjà clôturée." };

  await logAdminAction(supabase, {
    actorUserId: user.id,
    action: "CLOSE_COMPETITION",
    targetType: "competition",
    targetId: competitionId,
    after: { archivedPlayerCount: scoreRows.length },
  });

  revalidatePath("/admin/competitions");
  revalidatePath("/admin/competitions/results");
  revalidatePath("/leaderboard");
  revalidatePath("/bracket");
  revalidatePath("/home");
  revalidatePath("/play");

  return { success: true };
}

export type FreezeWeekActionResult = { success: true; message: string } | { success: false; error: string };

const frenchDate = (dateKey: string) => `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;

function describeFreeze(result: WeeklyFreezeResult): FreezeWeekActionResult {
  if (result.frozen) {
    const count = result.champions ?? 0;
    const who = count === 0 ? "aucun champion (meilleur total à 0 ou moins)" : count === 1 ? "1 champion" : `${count} co-champions`;
    const notes = [
      result.endLate ? "fin prise sur un snapshot en retard" : null,
      result.baselineLate ? "départ pris sur un snapshot plus ancien que prévu" : null,
      result.tiebreakAvailable === false ? "départage indisponible (classement aux points seuls)" : null,
    ].filter(Boolean);
    return {
      success: true,
      message: `Semaine du ${frenchDate(result.startSnapshotDate!)} au ${frenchDate(result.endSnapshotDate!)} figée : ${who}.${notes.length > 0 ? ` Attention : ${notes.join(" ; ")}.` : ""}`,
    };
  }
  if (result.skipped === "déjà figé") {
    return { success: true, message: `La semaine se terminant le ${frenchDate(result.weekEnd!)} est déjà figée.` };
  }
  return { success: false, error: `Rien n'a été figé : ${result.skipped ?? "raison inconnue"}.` };
}

// Bouton « Figer la semaine » (classement hebdo, lot 1) : complète le cron
// (idempotent, même fonction). Prend d'abord le snapshot du jour si besoin (la
// garde des 10h reste active : avant 10h Paris, rien n'est figé). L'envoi du
// récap hebdo n'en fait PAS partie : geste séparé, `sendWeeklyRecap`.
export async function freezeWeeklyRanking(): Promise<FreezeWeekActionResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, error: "Réservé aux admins." };

  let result: WeeklyFreezeResult;
  try {
    const now = Date.now();
    await runLeaderboardSnapshot(now);
    result = await runWeeklyFreeze(now, { frozenBy: "ADMIN" });
  } catch (error) {
    // Action réservée aux admins : le message brut (migration non poussée,
    // etc.) est plus utile que le message générique.
    return { success: false, error: error instanceof Error ? error.message : "Erreur inconnue." };
  }

  if (result.frozen) {
    const { data: active } = await supabase
      .from("competitions")
      .select("id")
      .eq("status", "ACTIVE")
      .maybeSingle<{ id: string }>();
    if (active) {
      await logAdminAction(supabase, {
        actorUserId: user.id,
        action: "FREEZE_WEEKLY_RANKING",
        targetType: "competition",
        targetId: active.id,
        after: { ...result },
      });
    }
    revalidatePath("/admin/competitions");
    revalidatePath("/leaderboard");
    revalidatePath("/home");
    revalidatePath("/profile");
  }

  return describeFreeze(result);
}

// Bouton « Envoyer le récap hebdo » (classement hebdo, lot 3) : push du
// champion figé de la dernière semaine close, 100 % manuel. Idempotent par
// joueur (`recap_log`) : relancer ne sert que ceux qui n'ont pas été servis.
// `test: true` = essai envoyé au seul admin appelant, rien n'est réservé ni
// figé (n'accepte aucune autre cible venant du client).
export async function sendWeeklyRecap(options: { test?: boolean } = {}): Promise<FreezeWeekActionResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, error: "Réservé aux admins." };

  let result: WeeklySendResult;
  try {
    result = await runWeeklyRecapSend(Date.now(), options.test ? { onlyUserId: user.id } : {});
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur inconnue." };
  }

  if (!result.sent) {
    const hint = result.skipped === "semaine non figée" ? " Fige d'abord la semaine." : "";
    return { success: false, error: `Rien n'a été envoyé : ${result.skipped ?? "raison inconnue"}.${hint}` };
  }

  if (result.test) {
    const where = result.preview ? " (semaine non figée : champion calculé en aperçu)" : "";
    return {
      success: true,
      message:
        result.notified > 0
          ? `Essai envoyé à ton compte${where}. Rien n'est réservé : l'envoi réel reste possible.`
          : "Essai non envoyé : ton compte n'a pas d'abonnement push actif (ou le récap du matin est désactivé).",
    };
  }

  const { data: active } = await supabase
    .from("competitions")
    .select("id")
    .eq("status", "ACTIVE")
    .maybeSingle<{ id: string }>();
  if (active) {
    await logAdminAction(supabase, {
      actorUserId: user.id,
      action: "SEND_WEEKLY_RECAP",
      targetType: "competition",
      targetId: active.id,
      after: { ...result },
    });
  }

  const extras = [
    result.alreadySent > 0 ? `${result.alreadySent} déjà servi${result.alreadySent > 1 ? "s" : ""}` : null,
    result.noSubscription > 0 ? `${result.noSubscription} sans abonnement push` : null,
  ].filter(Boolean);
  return {
    success: true,
    message: `Récap de la semaine du ${frenchDate(result.weekEnd!)} envoyé à ${result.notified} joueur${result.notified > 1 ? "s" : ""}${extras.length > 0 ? ` (${extras.join(", ")})` : ""}.`,
  };
}

// Interrupteur `competitions.weekly_ranking` (session admin : policy
// competitions_update = is_admin()). Variante `<form action>` native.
export async function setWeeklyRankingFormAction(formData: FormData): Promise<void> {
  const competitionId = String(formData.get("competition_id") ?? "");
  const enabled = formData.get("enabled") === "1";

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin || competitionId.length === 0) return;

  const { data: updated, error } = await supabase
    .from("competitions")
    .update({ weekly_ranking: enabled })
    .eq("id", competitionId)
    .eq("status", "ACTIVE")
    .select("id")
    .maybeSingle<{ id: string }>();
  // Erreur (migration absente) ou aucune ligne (plus ACTIVE) : rien n'a changé,
  // pas d'audit ; la page se rafraîchit et montre l'état réel.
  if (error || !updated) {
    revalidatePath("/admin/competitions");
    return;
  }

  await logAdminAction(supabase, {
    actorUserId: user.id,
    action: "SET_WEEKLY_RANKING",
    targetType: "competition",
    targetId: competitionId,
    after: { weeklyRanking: enabled },
  });
  revalidatePath("/admin/competitions");
  revalidatePath("/leaderboard");
}
