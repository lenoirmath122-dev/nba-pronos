import { getServerClient } from "@/lib/supabase/server";

// Lecture de l'écran Gestion des compétitions (SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1
// §1/§2). Lecture seule, session admin (getServerClient) — aucune donnée
// privilégiée exposée ici (le join_code est déjà visible des admins via
// competition_secrets, RLS secrets_all).

export type ActiveCompetitionSummary = {
  id: string;
  name: string;
  type: "PLAYOFFS" | "NBA_CUP";
  joinCode: string;
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
    .maybeSingle<{ id: string; name: string; type: "PLAYOFFS" | "NBA_CUP" }>();
  if (!competition) return null;

  const { data: secret } = await supabase
    .from("competition_secrets")
    .select("join_code")
    .eq("competition_id", competition.id)
    .maybeSingle<{ join_code: string }>();

  return { ...competition, joinCode: secret?.join_code ?? "—" };
}

export async function getTeamOptions(): Promise<TeamOption[]> {
  const supabase = await getServerClient();
  const { data } = await supabase.from("teams").select("id, name, abbreviation, conference").order("name");
  return (data ?? []) as TeamOption[];
}
