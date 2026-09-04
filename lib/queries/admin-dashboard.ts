import { getServerClient } from "@/lib/supabase/server";
import { computeBetDeadlinesPassed } from "@/lib/scoring/bet-deadline";

// Lecture du tableau de bord admin (composants serveur uniquement),
// SPEC_ECRAN_ADMIN_DASHBOARD_V0_1 §6. Un seul module, appelé avec
// getServerClient() : les requêtes passent par la RLS en session admin
// (is_admin(), T3), jamais service_role — écran de lecture pure.

type SupabaseServerClient = Awaited<ReturnType<typeof getServerClient>>;

export type AdminDashboardData = {
  competitionId: string | null; // null = aucune compétition active (§8)
  competitionName: string | null;
  pendingValidationCount: number;
  pendingResolutionCount: number;
  pendingRequestsCount: number;
};

const EMPTY_COUNTS = {
  pendingValidationCount: 0,
  pendingResolutionCount: 0,
  pendingRequestsCount: 0,
};

type CompetitionRow = { id: string; name: string };

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const supabase = await getServerClient();

  // Une seule compétition ACTIVE à la fois — aucune active ne vide PAS tout
  // l'écran (§8) : les compteurs de file retombent à 0, mais la page reste
  // utile (elle affiche quand même les entrées Gestion des joueurs / Logs).
  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name")
    .eq("status", "ACTIVE")
    .maybeSingle<CompetitionRow>();

  if (!competition) {
    return { competitionId: null, competitionName: null, ...EMPTY_COUNTS };
  }

  const [pendingValidationCount, pendingResolutionCount, pendingRequestsCount] =
    await Promise.all([
      getPendingValidationCount(supabase, competition.id),
      getPendingResolutionCount(supabase, competition.id),
      getPendingRequestsCount(supabase),
    ]);

  return {
    competitionId: competition.id,
    competitionName: competition.name,
    pendingValidationCount,
    pendingResolutionCount,
    pendingRequestsCount,
  };
}

// File de validation (§3.1) : paris SOUMIS de la compétition active. Même
// requête que lib/queries/home.ts::getAdminTodo (non réutilisée telle
// quelle : celle-ci ne construit pas de TodoItem, seulement un compte).
async function getPendingValidationCount(
  supabase: SupabaseServerClient,
  competitionId: string
): Promise<number> {
  const { count } = await supabase
    .from("bets")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId)
    .eq("status", "SUBMITTED");
  return count ?? 0;
}

type ValidatedBetRow = {
  id: string;
  scope: "MATCH" | "SERIES";
  series_id: string;
  match_id: string | null;
};

// File de résolution (§3.2) : paris VALIDÉS dont l'échéance est PASSÉE
// (public.bet_deadline_open(), via lib/scoring/bet-deadline.ts — B3).
async function getPendingResolutionCount(
  supabase: SupabaseServerClient,
  competitionId: string
): Promise<number> {
  const { data } = await supabase
    .from("bets")
    .select("id, scope, series_id, match_id")
    .eq("competition_id", competitionId)
    .eq("status", "VALIDATED");
  const bets = (data ?? []) as ValidatedBetRow[];
  if (bets.length === 0) return 0;

  const passedIds = await computeBetDeadlinesPassed(
    supabase,
    bets.map((bet) => ({ id: bet.id, scope: bet.scope, seriesId: bet.series_id, matchId: bet.match_id }))
  );
  return passedIds.size;
}

// File des requêtes (§3.3) : correction_requests EN_ATTENTE, TOUTES
// compétitions confondues (pas de délai limite en V1, 0.2.7 §6 — une requête
// restée en attente sur une compétition archivée doit rester visible ici).
async function getPendingRequestsCount(supabase: SupabaseServerClient): Promise<number> {
  const { count } = await supabase
    .from("correction_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "PENDING");
  return count ?? 0;
}
