import type { getServerClient } from "@/lib/supabase/server";

// Reproduit public.bet_deadline_open(scope, series_id, match_id) (migration
// #1) en TypeScript — seule implémentation depuis B3 (04/09/2026) :
// lib/queries/home.ts et lib/queries/admin-dashboard.ts dupliquaient chacun
// cette logique (BUG-002) avant d'être migrés vers computeBetDeadlines/
// computeBetDeadlinesPassed ci-dessous.

type SupabaseServerClient = Awaited<ReturnType<typeof getServerClient>>;

export type BetDeadlineTarget = { id: string; scope: "MATCH" | "SERIES"; seriesId: string; matchId: string | null };

/** Pour chaque pari fourni, calcule son échéance (coup d'envoi du match visé,
 *  ou du 1er match de la série visée) — `null` si aucun match planifié. */
export async function computeBetDeadlines(
  supabase: SupabaseServerClient,
  bets: BetDeadlineTarget[]
): Promise<Map<string, string | null>> {
  if (bets.length === 0) return new Map();

  const matchIds = [...new Set(bets.filter((b) => b.matchId).map((b) => b.matchId as string))];
  const seriesIds = [...new Set(bets.map((b) => b.seriesId))];

  const [{ data: targetMatches }, { data: seriesMatches }] = await Promise.all([
    matchIds.length > 0
      ? supabase.from("matches").select("id, scheduled_at").in("id", matchIds)
      : Promise.resolve({ data: [] as { id: string; scheduled_at: string | null }[] }),
    seriesIds.length > 0
      ? supabase
          .from("matches")
          .select("series_id, scheduled_at")
          .in("series_id", seriesIds)
          .not("scheduled_at", "is", null)
      : Promise.resolve({ data: [] as { series_id: string; scheduled_at: string | null }[] }),
  ]);

  const matchDeadline = new Map(
    (targetMatches ?? []).map((m) => [m.id as string, m.scheduled_at as string | null])
  );
  const seriesFirstMatch = new Map<string, string>();
  for (const m of (seriesMatches ?? []) as { series_id: string; scheduled_at: string }[]) {
    const current = seriesFirstMatch.get(m.series_id);
    if (!current || m.scheduled_at < current) seriesFirstMatch.set(m.series_id, m.scheduled_at);
  }

  const deadlines = new Map<string, string | null>();
  for (const bet of bets) {
    const deadline = bet.scope === "MATCH" ? (matchDeadline.get(bet.matchId ?? "") ?? null) : (seriesFirstMatch.get(bet.seriesId) ?? null);
    deadlines.set(bet.id, deadline);
  }
  return deadlines;
}

/** Pour chaque pari fourni, calcule si son échéance est DÉJÀ PASSÉE. */
export async function computeBetDeadlinesPassed(
  supabase: SupabaseServerClient,
  bets: BetDeadlineTarget[]
): Promise<Set<string>> {
  const deadlines = await computeBetDeadlines(supabase, bets);
  const nowMs = Date.now();
  const passed = new Set<string>();
  for (const bet of bets) {
    // deadline null = aucun match planifié -> toujours ouvert (cohérent
    // avec bet_deadline_open côté base).
    const deadline = deadlines.get(bet.id) ?? null;
    if (deadline !== null && Date.parse(deadline) <= nowMs) passed.add(bet.id);
  }
  return passed;
}
