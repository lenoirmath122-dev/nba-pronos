import { getServerClient } from "@/lib/supabase/server";

// Lecture des ligues (BACKLOG_V1.md « Système de ligue », migration #16).
// Composants serveur uniquement, RLS seule autorité (leagues_select /
// league_secrets_select / league_memberships_select : membre uniquement).

type SupabaseServerClient = Awaited<ReturnType<typeof getServerClient>>;

export type LeagueScope = { id: string; name: string; memberUserIds: Set<string> };

/** Résout un `?ligue=` en portée exploitable (nom + membres), réutilisé par
 *  tout écran qui filtre une liste "des autres joueurs" par ligue
 *  (Classement, Mes pronos, Bracket, 30/07/2026 — extrait de
 *  lib/queries/leaderboard.ts pour éviter une 3e implémentation divergente,
 *  même leçon que lib/dates/paris.ts). `leagues_select`/
 *  `league_memberships_select` (migration #16) ne renvoient quelque chose
 *  que si l'appelant est LUI-MÊME membre — un id invalide ou une ligue dont
 *  on n'est pas membre renvoie donc silencieusement `null` (repli sur "Général"
 *  côté appelant), jamais une erreur. */
export async function resolveLeagueScope(
  supabase: SupabaseServerClient,
  leagueId: string | null | undefined
): Promise<LeagueScope | null> {
  if (!leagueId) return null;

  const [{ data: league }, { data: members }] = await Promise.all([
    supabase.from("leagues").select("id, name").eq("id", leagueId).maybeSingle<{ id: string; name: string }>(),
    supabase.from("league_memberships").select("user_id").eq("league_id", leagueId),
  ]);

  if (!league) return null;

  return {
    id: league.id,
    name: league.name,
    memberUserIds: new Set((members ?? []).map((row) => row.user_id as string)),
  };
}

export type MyLeague = {
  id: string;
  name: string;
  code: string; // affiché pour inviter d'autres amis — connu de tout membre
  memberCount: number;
};

export async function getMyLeagues(): Promise<MyLeague[]> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: myMemberships } = await supabase
    .from("league_memberships")
    .select("league_id")
    .eq("user_id", user.id);

  const leagueIds = (myMemberships ?? []).map((row) => row.league_id as string);
  if (leagueIds.length === 0) return [];

  const [{ data: leagueRows }, { data: secretRows }, { data: memberRows }] = await Promise.all([
    supabase.from("leagues").select("id, name").in("id", leagueIds),
    supabase.from("league_secrets").select("league_id, code").in("league_id", leagueIds),
    supabase.from("league_memberships").select("league_id").in("league_id", leagueIds),
  ]);

  const codeByLeague = new Map(
    (secretRows ?? []).map((row) => [row.league_id as string, row.code as string])
  );
  const memberCountByLeague = new Map<string, number>();
  for (const row of memberRows ?? []) {
    const id = row.league_id as string;
    memberCountByLeague.set(id, (memberCountByLeague.get(id) ?? 0) + 1);
  }

  return (leagueRows ?? [])
    .map((row) => ({
      id: row.id as string,
      name: row.name as string,
      code: codeByLeague.get(row.id as string) ?? "",
      memberCount: memberCountByLeague.get(row.id as string) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
