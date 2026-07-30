import { getServerClient } from "@/lib/supabase/server";

// Lecture de l'écran Profil (SPEC_ECRAN_PROFIL_V0_1 §9). Composants serveur
// uniquement, RLS seule autorité (users_select : `using (true)`, aucune
// colonne secrète depuis le retrait de l'email, D5).

export type ProfileData = {
  pseudo: string;
  isAdmin: boolean;
  favoriteTeamId: string | null;
  bio: string;
  theme: "LIGHT" | "DARK";
  notificationPreference: "NONE" | "PUSH" | "EMAIL";
  tutorialSeenAt: string | null;
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
      "pseudo, role, favorite_team_id, bio, theme_preference, notification_preference, tutorial_seen_at"
    )
    .eq("id", user.id)
    .single<{
      pseudo: string;
      role: "PLAYER" | "ADMIN";
      favorite_team_id: string | null;
      bio: string | null;
      theme_preference: "LIGHT" | "DARK";
      notification_preference: "NONE" | "PUSH" | "EMAIL";
      tutorial_seen_at: string | null;
    }>();

  if (error || !data) return null;

  return {
    pseudo: data.pseudo,
    isAdmin: data.role === "ADMIN",
    favoriteTeamId: data.favorite_team_id,
    bio: data.bio ?? "",
    theme: data.theme_preference,
    notificationPreference: data.notification_preference,
    tutorialSeenAt: data.tutorial_seen_at,
  };
}

// Référentiel global des 30 équipes (D6, jamais scopé par compétition) — pour
// le sélecteur d'équipe favorite (§3).
export async function getTeamOptions(): Promise<TeamOption[]> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("teams")
    .select("id, abbreviation, name")
    .order("name", { ascending: true });

  if (error || !data) return [];

  return data.map((t) => ({ teamId: t.id, abbreviation: t.abbreviation, name: t.name }));
}
