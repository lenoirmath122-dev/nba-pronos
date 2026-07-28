"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/actions/audit";
import { assignRanks } from "@/lib/scoring/ranking";

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

export async function createCompetition(input: {
  name: string;
  type: "PLAYOFFS" | "NBA_CUP";
  round1Matchups?: [string, string][]; // 8 paires, ordre ROUND1_SLOTS — Playoffs uniquement
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

  let teamConferenceById: Map<string, "EAST" | "WEST"> | null = null;
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
    teamConferenceById = new Map((teamsData ?? []).map((t) => [t.id as string, t.conference as "EAST" | "WEST"]));
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

  const { data: competition, error: compErr } = await supabase
    .from("competitions")
    .insert({ name, type: input.type, status: "ACTIVE", bracket_deadline: null })
    .select("id")
    .single<{ id: string }>();
  if (compErr || !competition) return { success: false, error: compErr?.message ?? "Échec de la création." };

  const joinCode = randomUUID().slice(0, 8).toUpperCase();
  const { error: secretErr } = await supabase
    .from("competition_secrets")
    .insert({ competition_id: competition.id, join_code: joinCode });
  if (secretErr) return { success: false, error: secretErr.message };

  if (input.type === "PLAYOFFS" && input.round1Matchups) {
    try {
      await createPlayoffBracket(competition.id, input.round1Matchups);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Échec de la création du bracket." };
    }
  }

  await logAdminAction(supabase, {
    actorUserId: user.id,
    action: "CREATE_COMPETITION",
    targetType: "competition",
    targetId: competition.id,
    after: { name, type: input.type },
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

/**
 * Variante `<form action={...}>` NATIVE : FormData brut, appel de
 * l'action, puis REDIRECTION en cas d'erreur (le succès redirige déjà
 * depuis createCompetition). Même patron que les lots admin précédents.
 */
export async function createCompetitionFormAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "");
  const type = String(formData.get("type") ?? "") as "PLAYOFFS" | "NBA_CUP";

  let round1Matchups: [string, string][] | undefined;
  if (type === "PLAYOFFS") {
    round1Matchups = ROUND1_SLOTS.map((slot) => {
      const a = String(formData.get(`matchup_${slot}_a`) ?? "");
      const b = String(formData.get(`matchup_${slot}_b`) ?? "");
      return [a, b] as [string, string];
    });
  }

  const result = await createCompetition({ name, type, round1Matchups });

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
    if (archiveErr) return { success: false, error: archiveErr.message };
  }

  const { data: closed, error: closeErr } = await supabase
    .from("competitions")
    .update({ status: "ARCHIVED" })
    .eq("id", competitionId)
    .eq("status", "ACTIVE")
    .select("id")
    .maybeSingle();
  if (closeErr) return { success: false, error: closeErr.message };
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
