"use server";

import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";

// Server actions de l'écran Matchs (T6b §3.1, correctif post-validation
// 23/07/2026 — SPEC_ECRAN_MATCHS §14/§18.1). Session utilisateur uniquement
// (getServerClient, jamais service_role) : la RLS (T3 §5) reste le garde-fou
// de fond, ces gardes applicatives ne font que produire un message clair —
// jamais l'inverse (T6b §3.1).

export type ActionResult = { success: true } | { success: false; error: string };

type SupabaseServerClient = Awaited<ReturnType<typeof getServerClient>>;

async function requireUser(supabase: SupabaseServerClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Écrit/écrase le brouillon du joueur (upsert). Les deux champs sont
 * OPTIONNELS (correctif post-validation T6b §3.1, §18.1) : un champ absent
 * (undefined) n'est pas écrit, un champ à null vide explicitement la valeur.
 * Le brouillon PARTIEL est un état produit acquis (0.2.3 §5, 0.2.9 §4) — cette
 * action doit pouvoir l'enregistrer, pas seulement le brouillon complet.
 */
export async function saveMatchPredictionDraft(input: {
  matchId: string;
  predictedWinnerTeamId?: string | null;
  predictedMargin?: number | null;
}): Promise<ActionResult> {
  const supabase = await getServerClient();
  const user = await requireUser(supabase);
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const { data: match } = await supabase
    .from("matches")
    .select("id, competition_id, home_team_id, away_team_id, scheduled_at")
    .eq("id", input.matchId)
    .maybeSingle();
  if (!match) return { success: false, error: "Match introuvable." };

  // Redondant avec la RLS (match_is_locked), message clair en plus (T6b §3.1).
  if (match.scheduled_at && Date.parse(match.scheduled_at) <= Date.now()) {
    return { success: false, error: "Ce match est déjà verrouillé." };
  }

  if (
    input.predictedWinnerTeamId !== undefined &&
    input.predictedWinnerTeamId !== null &&
    input.predictedWinnerTeamId !== match.home_team_id &&
    input.predictedWinnerTeamId !== match.away_team_id
  ) {
    return { success: false, error: "Cette équipe ne joue pas ce match." };
  }

  if (
    input.predictedMargin !== undefined &&
    input.predictedMargin !== null &&
    (!Number.isInteger(input.predictedMargin) || input.predictedMargin < 1 || input.predictedMargin > 50)
  ) {
    return { success: false, error: "L'écart doit être un nombre entier entre 1 et 50." };
  }

  const { data: existing } = await supabase
    .from("match_predictions")
    .select("status")
    .eq("user_id", user.id)
    .eq("match_id", input.matchId)
    .maybeSingle();
  if (existing?.status === "VALIDATED") {
    return { success: false, error: "Ce prono est déjà validé, il n'est plus modifiable." };
  }

  // Upsert PARTIEL : seules les clés PRÉSENTES dans le payload sont écrites
  // (Postgres ON CONFLICT DO UPDATE SET ne touche que les colonnes fournies) —
  // un champ absent (undefined) n'écrase donc jamais la valeur déjà en base.
  const patch: Record<string, unknown> = {
    user_id: user.id,
    match_id: input.matchId,
    competition_id: match.competition_id,
  };
  if (input.predictedWinnerTeamId !== undefined) {
    patch.predicted_winner_team_id = input.predictedWinnerTeamId;
  }
  if (input.predictedMargin !== undefined) {
    patch.predicted_margin = input.predictedMargin;
  }

  const { error } = await supabase
    .from("match_predictions")
    .upsert(patch, { onConflict: "user_id,match_id" });
  if (error) return { success: false, error: "Impossible d'enregistrer le brouillon." };

  revalidatePath("/play");
  revalidatePath("/home");
  return { success: true };
}

/** INCHANGÉE — exige toujours les 2 champs complets. Irréversible. */
export async function validateMatchPrediction(matchId: string): Promise<ActionResult> {
  const supabase = await getServerClient();
  const user = await requireUser(supabase);
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const { data: existing } = await supabase
    .from("match_predictions")
    .select("status, predicted_winner_team_id, predicted_margin")
    .eq("user_id", user.id)
    .eq("match_id", matchId)
    .maybeSingle();

  if (!existing || existing.predicted_winner_team_id === null || existing.predicted_margin === null) {
    return { success: false, error: "Choisis un vainqueur et un écart avant de valider." };
  }
  if (existing.status === "VALIDATED") {
    return { success: false, error: "Ce prono est déjà validé." };
  }

  const { error } = await supabase
    .from("match_predictions")
    .update({ status: "VALIDATED", validated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("match_id", matchId);
  if (error) return { success: false, error: "Impossible de valider ce prono." };

  revalidatePath("/play");
  revalidatePath("/home");
  return { success: true };
}

/**
 * « Tout valider » (§9) : ne bascule que les brouillons COMPLETS du joueur.
 * L'écran affiche la confirmation AVANT d'appeler (0.2.9 §4) — cette action
 * ne confirme rien elle-même.
 */
export async function validateAllCompleteMatchPredictions(): Promise<{ validatedMatchIds: string[] }> {
  const supabase = await getServerClient();
  const user = await requireUser(supabase);
  if (!user) return { validatedMatchIds: [] };

  const { data: drafts } = await supabase
    .from("match_predictions")
    .select("match_id")
    .eq("user_id", user.id)
    .eq("status", "DRAFT")
    .not("predicted_winner_team_id", "is", null)
    .not("predicted_margin", "is", null);

  const matchIds = (drafts ?? []).map((row) => row.match_id as string);
  if (matchIds.length === 0) return { validatedMatchIds: [] };

  const { data: updated, error } = await supabase
    .from("match_predictions")
    .update({ status: "VALIDATED", validated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .in("match_id", matchIds)
    .select("match_id");

  if (error) return { validatedMatchIds: [] };

  revalidatePath("/play");
  revalidatePath("/home");
  return { validatedMatchIds: (updated ?? []).map((row) => row.match_id as string) };
}
