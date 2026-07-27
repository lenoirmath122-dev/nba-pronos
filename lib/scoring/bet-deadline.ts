import type { getServerClient } from "@/lib/supabase/server";

// Reproduit public.bet_deadline_open(scope, series_id, match_id) (migration
// #1) en TypeScript — FACTORISÉ ici après avoir été dupliqué 3 fois
// (lib/queries/bets.ts, lib/queries/home.ts, lib/queries/admin-dashboard.ts)
// — 4e utilisateur (file de résolution admin), piège déjà noté pour cette
// exacte fonction (ETAT_ACTUEL §7 : « ne pas dupliquer une 3e fois »),
// cette fois vraiment corrigé plutôt que reporté. Les 3 sites existants ne
// sont PAS retouchés dans ce lot (code déjà testé/committé, zéro
// changement de comportement à risquer pour un lot qui n'en a pas besoin).

type SupabaseServerClient = Awaited<ReturnType<typeof getServerClient>>;

export type BetDeadlineTarget = { id: string; scope: "MATCH" | "SERIES"; seriesId: string; matchId: string | null };

/** Pour chaque pari fourni, calcule si son échéance (coup d'envoi du match
 *  visé, ou du 1er match de la série visée) est DÉJÀ PASSÉE. */
export async function computeBetDeadlinesPassed(
  supabase: SupabaseServerClient,
  bets: BetDeadlineTarget[]
): Promise<Set<string>> {
  if (bets.length === 0) return new Set();

  const matchIds = [...new Set(bets.filter((b) => b.matchId).map((b) => b.matchId as string))];
  const seriesIds = [...new Set(bets.map((b) => b.seriesId))];

  const [{ data: targetMatches }, { data: seriesMatches }] = await Promise.all([
    matchIds.length > 0
      ? supabase.from("matches").select("id, scheduled_at").in("id", matchIds)
      : Promise.resolve({ data: [] as { id: string; scheduled_at: string | null }[] }),
    supabase
      .from("matches")
      .select("series_id, scheduled_at")
      .in("series_id", seriesIds)
      .not("scheduled_at", "is", null),
  ]);

  const matchDeadline = new Map(
    (targetMatches ?? []).map((m) => [m.id as string, m.scheduled_at as string | null])
  );
  const seriesFirstMatch = new Map<string, string>();
  for (const m of (seriesMatches ?? []) as { series_id: string; scheduled_at: string }[]) {
    const current = seriesFirstMatch.get(m.series_id);
    if (!current || m.scheduled_at < current) seriesFirstMatch.set(m.series_id, m.scheduled_at);
  }

  const nowMs = Date.now();
  const passed = new Set<string>();
  for (const bet of bets) {
    const deadline = bet.scope === "MATCH" ? (matchDeadline.get(bet.matchId ?? "") ?? null) : (seriesFirstMatch.get(bet.seriesId) ?? null);
    // deadline null = aucun match planifié -> toujours ouvert (cohérent
    // avec bet_deadline_open côté base).
    if (deadline !== null && Date.parse(deadline) <= nowMs) passed.add(bet.id);
  }
  return passed;
}
