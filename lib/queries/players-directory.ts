import { getServerClient } from "@/lib/supabase/server";
import type { TeamRef } from "@/lib/queries/matches";

// Annuaire des joueurs (`/players`, index manquant jusqu'ici — la seule route
// existante était `/players/[userId]`, un pseudo cliqué ailleurs y menait,
// mais rien n'atterrissait sur `/players` nu : 404, cf. GAPS_OUVERTS.md
// "Phase 0"). Même patron RLS que player-profile.ts : `users_select using
// (true)` est la seule autorité, visiteur ou joueur connecté voient la même
// liste. Alphabétique par pseudo — pas de tri par score ici, c'est déjà le
// rôle du Classement.

export type PlayerDirectoryEntry = {
  userId: string;
  pseudo: string;
  favoriteTeam: TeamRef | null;
  isAdmin: boolean;
  isInactive: boolean;
};

type UserRow = {
  id: string;
  pseudo: string;
  role: "PLAYER" | "ADMIN";
  status: "ACTIVE" | "DISABLED";
  favorite_team_id: string | null;
};

type TeamRow = { id: string; abbreviation: string; name: string };

export async function getPlayersDirectory(): Promise<PlayerDirectoryEntry[]> {
  const supabase = await getServerClient();

  const { data: users } = await supabase
    .from("users")
    .select("id, pseudo, role, status, favorite_team_id")
    .order("pseudo", { ascending: true });

  const userRows = (users ?? []) as UserRow[];
  if (userRows.length === 0) return [];

  const teamIds = [...new Set(userRows.map((row) => row.favorite_team_id).filter((id): id is string => id !== null))];
  const teamById = new Map<string, TeamRow>();
  if (teamIds.length > 0) {
    const { data: teams } = await supabase.from("teams").select("id, abbreviation, name").in("id", teamIds);
    for (const team of (teams ?? []) as TeamRow[]) teamById.set(team.id, team);
  }

  return userRows.map((row) => {
    const team = row.favorite_team_id ? teamById.get(row.favorite_team_id) : undefined;
    return {
      userId: row.id,
      pseudo: row.pseudo,
      favoriteTeam: team ? { id: team.id, abbreviation: team.abbreviation, name: team.name } : null,
      isAdmin: row.role === "ADMIN",
      isInactive: row.status === "DISABLED",
    };
  });
}
