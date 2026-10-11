import { getServerClient } from "@/lib/supabase/server";
import type { CompetitionType } from "@/lib/competitions/types";

// Lecture de l'écran Gestion des compétitions (SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1
// §1/§2). Lecture seule, session admin (getServerClient) — aucune donnée
// privilégiée exposée ici (le join_code est déjà visible des admins via
// competition_secrets, RLS secrets_all).

export type ActiveCompetitionSummary = {
  id: string;
  name: string;
  type: CompetitionType;
  joinCode: string;
  /** Null : colonne absente (migration 20261012090000 pas encore poussée). */
  weeklyRanking: boolean | null;
  lastFrozenWeek: { weekEnd: string; champions: number } | null;
};

export type TeamOption = {
  id: string;
  name: string;
  abbreviation: string;
  conference: "EAST" | "WEST";
};

export async function getActiveCompetitionSummary(): Promise<ActiveCompetitionSummary | null> {
  const supabase = await getServerClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name, type")
    .eq("status", "ACTIVE")
    .maybeSingle<{ id: string; name: string; type: CompetitionType }>();
  if (!competition) return null;

  const { data: secret } = await supabase
    .from("competition_secrets")
    .select("join_code")
    .eq("competition_id", competition.id)
    .maybeSingle<{ join_code: string }>();

  // Lectures SÉPARÉES et tolérantes : si la migration du classement hebdo
  // n'est pas poussée, l'écran reste utilisable (ajouter la colonne au select
  // ci-dessus ferait afficher « Aucune compétition en cours »).
  const { data: flag, error: flagError } = await supabase
    .from("competitions")
    .select("weekly_ranking")
    .eq("id", competition.id)
    .maybeSingle<{ weekly_ranking: boolean }>();
  const weeklyRanking = flagError || !flag ? null : flag.weekly_ranking;

  let lastFrozenWeek: ActiveCompetitionSummary["lastFrozenWeek"] = null;
  if (weeklyRanking !== null) {
    const { data: last } = await supabase
      .from("weekly_rankings")
      .select("week_end_date")
      .eq("competition_id", competition.id)
      .order("week_end_date", { ascending: false })
      .limit(1)
      .maybeSingle<{ week_end_date: string }>();
    if (last) {
      const { count } = await supabase
        .from("weekly_champions")
        .select("id", { count: "exact", head: true })
        .eq("competition_id", competition.id)
        .eq("week_end_date", last.week_end_date);
      lastFrozenWeek = { weekEnd: last.week_end_date, champions: count ?? 0 };
    }
  }

  return { ...competition, joinCode: secret?.join_code ?? "—", weeklyRanking, lastFrozenWeek };
}

export async function getTeamOptions(): Promise<TeamOption[]> {
  const supabase = await getServerClient();
  const { data } = await supabase.from("teams").select("id, name, abbreviation, conference").order("name");
  return (data ?? []) as TeamOption[];
}
