import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { getProfileBadges } from "@/lib/queries/badges";

// Export de données en self-service (§8.2 conseils_juridiques_deploiement_
// application.md, cadré le 03/09/2026) — route authentifiée par SESSION
// (getServerClient, cookies), pas par le Bearer SYNC_SECRET des autres
// routes app/api/* (celles-ci sont des jobs planifiés, pas des requêtes
// joueur). Un simple <a href> depuis le profil suffit (GET + Content-
// Disposition = téléchargement natif, aucun JS nécessaire). JSON brut, pas
// de format d'interopérabilité sophistiqué (pas nécessaire à cette échelle).
//
// Scope initial (§8.2, 03/09/2026) : profil, paris, messages de chat,
// signalements de bug, appartenances aux ligues. Complété le 09/09/2026
// (p1-21, feuille de route Phase 1) avec les pronos de match, le bracket et
// les badges — mêmes RLS `_select` que les autres tables ici (propriétaire
// toujours autorisé à lire ses propres lignes, cf. 20260718110000_rls.sql),
// donc le client authentifié par session suffit, pas besoin de service_role.
// Les badges n'ont pas de table dédiée (calculés à la volée depuis des vues
// agrégées, lib/queries/badges.ts) — on réutilise directement
// getProfileBadges() plutôt que dupliquer sa logique de résolution des tiers.
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

  const [profile, bets, matchPredictions, brackets, chatMessages, bugReports, leagueMemberships, badges] =
    await Promise.all([
      supabase
        .from("users")
        .select("pseudo, bio, favorite_team_id, theme_preference, background_theme, notification_preference, age_confirmed_at, created_at")
        .eq("id", user.id)
        .single(),
      supabase.from("bets").select("*").eq("user_id", user.id),
      supabase.from("match_predictions").select("*").eq("user_id", user.id),
      supabase.from("brackets").select("*").eq("user_id", user.id),
      supabase.from("chat_messages").select("*").eq("user_id", user.id),
      supabase.from("bug_reports").select("*").eq("user_id", user.id),
      supabase.from("league_memberships").select("*").eq("user_id", user.id),
      getProfileBadges(user.id),
    ]);

  // bracket_picks n'a pas de user_id direct (propriété via bracket_id) --
  // même détour que scripts/delete-player-account.mjs, une fois les
  // brackets de l'utilisateur connus.
  const bracketIds = (brackets.data ?? []).map((bracket) => bracket.id as string);
  const bracketPicks =
    bracketIds.length > 0
      ? await supabase.from("bracket_picks").select("*").in("bracket_id", bracketIds)
      : { data: [] as { bracket_id: string }[] };

  const exportPayload = {
    generated_at: new Date().toISOString(),
    profile: profile.data ?? null,
    bets: bets.data ?? [],
    match_predictions: matchPredictions.data ?? [],
    brackets: (brackets.data ?? []).map((bracket) => ({
      ...bracket,
      picks: (bracketPicks.data ?? []).filter((pick) => pick.bracket_id === bracket.id),
    })),
    badges,
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
