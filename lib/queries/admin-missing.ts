import { getServerClient } from "@/lib/supabase/server";
import type { TeamRef } from "@/lib/queries/matches";

// Lecture de l'écran admin "Qui manque à l'appel" (BACKLOG_V1.md « Confort
// au quotidien »). Composant serveur uniquement, session ADMIN (garde de
// rôle déjà posée par app/(admin)/admin/layout.tsx) — les policies admin
// (`match_predictions_select`/`brackets_select`, migration #3 : `using
// (user_id = auth.uid() or is_admin())`) donnent déjà une visibilité
// complète, aucune confidentialité à recalculer ici contrairement à l'écran
// joueur Matchs (§8, isRevealed).
//
// Périmètre confirmé AVEC l'utilisateur (30/07/2026) : matchs à venir (même
// fenêtre 3 jours que l'écran Matchs, §2/§18.2 — jamais sur matches.status)
// ET la deadline du bracket, présentés PAR MATCH (un bloc par match, liste
// nominative des joueurs ACTIVE n'ayant pas encore validé CE match précis) —
// pas une liste agrégée par joueur.

const WINDOW_DAYS = 3;

// Ajouté le 30/07/2026 : userId à côté du pseudo, pour le lien
// /players/[userId] (PlayerLink) — auparavant un simple string.
export type MissingPlayer = { userId: string; pseudo: string };

export type MissingMatchBlock = {
  matchId: string;
  scheduledAt: string;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  missingPlayers: MissingPlayer[]; // ACTIVE, triés alphabétiquement
};

export type MissingBracketBlock = {
  deadline: string; // ISO ; ce bloc n'existe que si la deadline est CONNUE et PAS ENCORE PASSÉE
  missingPlayers: MissingPlayer[];
};

export type AdminMissingData = {
  competitionId: string | null; // null = aucune compétition active
  matches: MissingMatchBlock[];
  bracket: MissingBracketBlock | null;
};

function emptyData(): AdminMissingData {
  return { competitionId: null, matches: [], bracket: null };
}

type CompetitionRow = { id: string; bracket_deadline: string | null };
type TeamRow = { id: string; name: string; abbreviation: string };
type ActiveUserRow = { id: string; pseudo: string };

export async function getAdminMissingData(): Promise<AdminMissingData> {
  const supabase = await getServerClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, bracket_deadline")
    .eq("status", "ACTIVE")
    .maybeSingle<CompetitionRow>();

  if (!competition) return emptyData();

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const windowEndIso = new Date(nowMs + WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: matchesData }, { data: activeUsersData }, { data: teamsData }] = await Promise.all([
    supabase
      .from("matches")
      .select("id, series_id, scheduled_at, home_team_id, away_team_id")
      .eq("competition_id", competition.id)
      .not("scheduled_at", "is", null)
      .gt("scheduled_at", nowIso)
      .lte("scheduled_at", windowEndIso)
      .order("scheduled_at", { ascending: true }),
    supabase.from("users").select("id, pseudo").eq("status", "ACTIVE"),
    supabase.from("teams").select("id, name, abbreviation"),
  ]);

  const activeUsers = ((activeUsersData ?? []) as ActiveUserRow[]).sort((a, b) =>
    a.pseudo.localeCompare(b.pseudo)
  );
  const teams = new Map(
    ((teamsData ?? []) as TeamRow[]).map((t) => [t.id, { id: t.id, abbreviation: t.abbreviation, name: t.name }])
  );

  type MatchRow = {
    id: string;
    scheduled_at: string;
    home_team_id: string | null;
    away_team_id: string | null;
  };
  const matches = (matchesData ?? []) as MatchRow[];

  let matchBlocks: MissingMatchBlock[] = [];
  if (matches.length > 0) {
    const matchIds = matches.map((m) => m.id);
    // Admin bypasse la RLS (is_admin()) : lecture directe, pas
    // count_committed_predictions (qui ne renvoie qu'un compte, pas les
    // identités). "Committed" = statut <> DRAFT, même définition que la
    // fonction (migration #6).
    const { data: committedData } = await supabase
      .from("match_predictions")
      .select("match_id, user_id")
      .in("match_id", matchIds)
      .neq("status", "DRAFT");

    const committedUserIdsByMatch = new Map<string, Set<string>>();
    for (const row of committedData ?? []) {
      const matchId = row.match_id as string;
      const set = committedUserIdsByMatch.get(matchId) ?? new Set<string>();
      set.add(row.user_id as string);
      committedUserIdsByMatch.set(matchId, set);
    }

    matchBlocks = matches
      .map((match) => {
        const committed = committedUserIdsByMatch.get(match.id) ?? new Set<string>();
        const missingPlayers = activeUsers
          .filter((u) => !committed.has(u.id))
          .map((u) => ({ userId: u.id, pseudo: u.pseudo }));
        return {
          matchId: match.id,
          scheduledAt: match.scheduled_at,
          homeTeam: teams.get(match.home_team_id ?? "") ?? { id: "", abbreviation: "?", name: "?" },
          awayTeam: teams.get(match.away_team_id ?? "") ?? { id: "", abbreviation: "?", name: "?" },
          missingPlayers,
        };
      })
      .filter((block) => block.missingPlayers.length > 0);
  }

  let bracket: MissingBracketBlock | null = null;
  if (competition.bracket_deadline && Date.parse(competition.bracket_deadline) > nowMs) {
    const { data: validatedData } = await supabase
      .from("brackets")
      .select("user_id")
      .eq("competition_id", competition.id)
      .or("is_validated.eq.true,is_auto_validated.eq.true");

    const validatedUserIds = new Set((validatedData ?? []).map((row) => row.user_id as string));
    const missingPlayers = activeUsers
      .filter((u) => !validatedUserIds.has(u.id))
      .map((u) => ({ userId: u.id, pseudo: u.pseudo }));

    if (missingPlayers.length > 0) {
      bracket = { deadline: competition.bracket_deadline, missingPlayers };
    }
  }

  return { competitionId: competition.id, matches: matchBlocks, bracket };
}
