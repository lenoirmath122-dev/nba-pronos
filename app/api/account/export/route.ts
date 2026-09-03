import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";

// Export de données en self-service (§8.2 conseils_juridiques_deploiement_
// application.md, cadré le 03/09/2026) — route authentifiée par SESSION
// (getServerClient, cookies), pas par le Bearer SYNC_SECRET des autres
// routes app/api/* (celles-ci sont des jobs planifiés, pas des requêtes
// joueur). Un simple <a href> depuis le profil suffit (GET + Content-
// Disposition = téléchargement natif, aucun JS nécessaire). Scope de données
// = exactement §8.2 : profil, paris, messages de chat, signalements de bug,
// appartenances aux ligues. JSON brut, pas de format d'interopérabilité
// sophistiqué (pas nécessaire à cette échelle).
export const runtime = "nodejs";

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function GET(): Promise<Response> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const [profile, bets, chatMessages, bugReports, leagueMemberships] = await Promise.all([
    supabase
      .from("users")
      .select("pseudo, bio, favorite_team_id, theme_preference, background_theme, notification_preference, age_confirmed_at, created_at")
      .eq("id", user.id)
      .single(),
    supabase.from("bets").select("*").eq("user_id", user.id),
    supabase.from("chat_messages").select("*").eq("user_id", user.id),
    supabase.from("bug_reports").select("*").eq("user_id", user.id),
    supabase.from("league_memberships").select("*").eq("user_id", user.id),
  ]);

  const exportPayload = {
    generated_at: new Date().toISOString(),
    profile: profile.data ?? null,
    bets: bets.data ?? [],
    chat_messages: chatMessages.data ?? [],
    bug_reports: bugReports.data ?? [],
    league_memberships: leagueMemberships.data ?? [],
  };

  const filename = `panier-ballon-donnees-${sanitizeFilenamePart(profile.data?.pseudo ?? user.id)}.json`;

  return new Response(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
