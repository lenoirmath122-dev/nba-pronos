import { getServerClient } from "@/lib/supabase/server";
import { getAllTeams } from "@/lib/queries/teams";
import type { TeamRef } from "@/lib/queries/matches";

// Lecture de l'écran Profil (SPEC_ECRAN_PROFIL_V0_1 §9). Composants serveur
// uniquement, RLS seule autorité (users_select : `using (true)`, aucune
// colonne secrète depuis le retrait de l'email, D5).

export type ProfileData = {
  pseudo: string;
  isAdmin: boolean;
  favoriteTeamId: string | null;
  /** Résolu en plus de favoriteTeamId (même patron que
   *  lib/queries/player-profile.ts::fetchTeam) — sert à la personnalisation
   *  du bandeau par équipe favorite (04/08/2026, cf. lib/labels/teamColors.ts). */
  favoriteTeam: TeamRef | null;
  bio: string;
  /** 3e valeur PHOTO ajoutée le 06/08/2026 (migrations 20260806100000/
   *  20260806110000) : Sombre/Clair/Photo sont désormais 3 choix
   *  mutuellement exclusifs, `backgroundTheme` ci-dessous n'a plus d'effet
   *  visuel que si `theme === "PHOTO"` (app/globals.css). */
  theme: "LIGHT" | "DARK" | "PHOTO";
  /** Fond d'écran plein page (§.photo-page, app/globals.css) — même patron
   *  que `theme`, lu ici pour l'écran Profil ; app/layout.tsx fait sa PROPRE
   *  lecture pour poser l'attribut data-bg sur <html> (même redondance
   *  assumée que theme_preference, cf. commentaire de getTheme()). */
  backgroundTheme: "MURAL" | "HOOP" | "HK";
  notificationPreference: "NONE" | "PUSH" | "EMAIL";
};

export type TeamOption = {
  teamId: string;
  abbreviation: string;
  name: string;
};

export async function getProfileData(): Promise<ProfileData | null> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // ne devrait pas se produire : le layout (app) garde déjà la session.

  const { data, error } = await supabase
    .from("users")
    .select(
      "pseudo, role, favorite_team_id, bio, theme_preference, background_theme, notification_preference"
    )
    .eq("id", user.id)
    .single<{
      pseudo: string;
      role: "PLAYER" | "ADMIN";
      favorite_team_id: string | null;
      bio: string | null;
      theme_preference: "LIGHT" | "DARK" | "PHOTO";
      background_theme: "MURAL" | "HOOP" | "HK";
      notification_preference: "NONE" | "PUSH" | "EMAIL";
    }>();

  if (error || !data) return null;

  const favoriteTeam = data.favorite_team_id ? await fetchTeam(data.favorite_team_id) : null;

  return {
    pseudo: data.pseudo,
    isAdmin: data.role === "ADMIN",
    favoriteTeamId: data.favorite_team_id,
    favoriteTeam,
    bio: data.bio ?? "",
    theme: data.theme_preference,
    backgroundTheme: data.background_theme,
    notificationPreference: data.notification_preference,
  };
}

async function fetchTeam(teamId: string): Promise<TeamRef | null> {
  const teams = await getAllTeams();
  const team = teams.find((t) => t.id === teamId);
  return team ? { id: team.id, abbreviation: team.abbreviation, name: team.name } : null;
}

// Référentiel global des 30 équipes (D6, jamais scopé par compétition) — pour
// le sélecteur d'équipe favorite (§3).
export async function getTeamOptions(): Promise<TeamOption[]> {
  const teams = await getAllTeams();

  return [...teams]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => ({ teamId: t.id, abbreviation: t.abbreviation, name: t.name }));
}
