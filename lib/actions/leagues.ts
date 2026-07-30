"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";

// Server actions "Mes ligues" (Profil, BACKLOG_V1.md « Système de ligue »,
// migration #16). Écriture via .rpc() sur create_league/join_league
// (SECURITY DEFINER, garde-fous côté base — aucune logique dupliquée ici,
// même patron que requestPredictionCorrection). Quitter reste un DELETE
// direct, RLS suffit (league_memberships_delete). Formulaires natifs SANS JS
// (§1 des autres écrans) : chaque action reçoit un FormData brut et REDIRIGE,
// même patron que lib/actions/profile.ts — l'erreur ou le résultat est porté
// par l'URL de redirection, jamais par un état client.

export async function createLeagueFormAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .rpc("create_league", { p_name: name })
    .single<{ id: string; name: string; code: string }>();

  if (error || !data) {
    redirect(`/profile?tab=ligues&leagueError=${encodeURIComponent(error?.message ?? "Échec de la création.")}`);
  }

  revalidatePath("/profile");
  revalidatePath("/leaderboard"); // nouvelle ligue disponible dans le sélecteur de portée
  redirect(
    `/profile?tab=ligues&newLeagueName=${encodeURIComponent(data.name)}&newLeagueCode=${encodeURIComponent(data.code)}`
  );
}

export async function joinLeagueFormAction(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "").trim();

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .rpc("join_league", { p_code: code })
    .single<{ id: string; name: string }>();

  if (error || !data) {
    redirect(`/profile?tab=ligues&leagueError=${encodeURIComponent(error?.message ?? "Code invalide.")}`);
  }

  revalidatePath("/profile");
  revalidatePath("/leaderboard");
  redirect(`/profile?tab=ligues&leagueJoined=${encodeURIComponent(data.name)}`);
}

export async function leaveLeagueFormAction(formData: FormData): Promise<void> {
  const leagueId = String(formData.get("leagueId") ?? "");

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("league_memberships")
    .delete()
    .eq("league_id", leagueId)
    .eq("user_id", user!.id);

  if (error) {
    redirect(`/profile?tab=ligues&leagueError=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/leaderboard");
  redirect("/profile?tab=ligues");
}
