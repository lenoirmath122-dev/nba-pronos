"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/actions/audit";
import type { BetCategory, BetDifficulty } from "@/lib/labels/bets";

// Écriture de la file de validation (SPEC_ECRAN_ADMIN_VALIDATION_V0_1 §4).
// Catégorie B SANS recompute (T6a §5.3) : session admin (getServerClient),
// RLS bets_update_admin = is_admin() — AUCUNE fonction SQL SECURITY DEFINER,
// contrairement à save_bet/request_prediction_correction.

export type ActionResult = { success: true } | { success: false; error: string };

// ADMIN = joueur + droits admin (0.2.1) : un admin peut donc soumettre SES
// PROPRES paris. Aucune garde n'empêchait jusqu'ici de les valider/rejeter
// lui-même (trouvé 28/07/2026, GAPS_OUVERTS.md) — même principe que
// « un admin ne peut jamais traiter sa propre requête de correction » (0.2.3),
// jamais étendu à la file de validation normale des paris. Étendu ici par
// symétrie, pas une nouvelle règle produit inventée.
async function assertNotOwnBet(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  betId: string,
  adminUserId: string
): Promise<string | null> {
  const { data: bet } = await supabase.from("bets").select("user_id").eq("id", betId).maybeSingle<{ user_id: string }>();
  if (bet?.user_id === adminUserId) {
    return "Tu ne peux pas traiter ton propre pari — demande à un autre admin.";
  }
  return null;
}

export async function validateBet(input: {
  betId: string;
  validatedDifficulty: BetDifficulty;
  validatedCategory: BetCategory;
}): Promise<ActionResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const ownBetError = await assertNotOwnBet(supabase, input.betId, user.id);
  if (ownBetError) return { success: false, error: ownBetError };

  // Re-garde le statut dans le WHERE de l'UPDATE, pas seulement en lecture
  // avant : une condition qui ne matche aucune ligne réussit SANS erreur
  // (piège déjà rencontré, ETAT_ACTUEL §7) — .select().maybeSingle() détecte
  // le cas "déjà traité par un autre admin" entre l'affichage et le clic.
  const { data: updated, error } = await supabase
    .from("bets")
    .update({
      status: "VALIDATED",
      validated_category: input.validatedCategory,
      validated_difficulty: input.validatedDifficulty,
      validated_at: new Date().toISOString(),
      validated_by_admin_id: user.id,
    })
    .eq("id", input.betId)
    .eq("status", "SUBMITTED")
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!updated) return { success: false, error: "Ce pari a déjà été traité." };

  await logAdminAction(supabase, {
    actorUserId: user.id,
    action: "VALIDATE_BET",
    targetType: "bet",
    targetId: input.betId,
    after: { validatedCategory: input.validatedCategory, validatedDifficulty: input.validatedDifficulty },
  });

  revalidatePath("/admin/validation");
  revalidatePath("/admin");
  return { success: true };
}

export async function rejectBet(input: { betId: string; refusalReason: string }): Promise<ActionResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const ownBetError = await assertNotOwnBet(supabase, input.betId, user.id);
  if (ownBetError) return { success: false, error: ownBetError };

  const reason = input.refusalReason.trim();
  if (reason.length === 0) return { success: false, error: "Un motif est obligatoire pour refuser un pari." };

  const { data: updated, error } = await supabase
    .from("bets")
    .update({ status: "REJECTED", refusal_reason: reason })
    .eq("id", input.betId)
    .eq("status", "SUBMITTED")
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!updated) return { success: false, error: "Ce pari a déjà été traité." };

  await logAdminAction(supabase, {
    actorUserId: user.id,
    action: "REJECT_BET",
    targetType: "bet",
    targetId: input.betId,
    reason,
  });

  revalidatePath("/admin/validation");
  revalidatePath("/admin");
  return { success: true };
}

/**
 * Variantes `<form action={...}>` NATIVES (aucun JS) : FormData brut, appel
 * de l'action, puis REDIRECTION — l'erreur est portée par l'URL, rendue par
 * la page au rechargement. Même patron que requestBetCorrectionFormAction
 * (lib/actions/bet-corrections.ts).
 */
export async function validateBetFormAction(formData: FormData): Promise<void> {
  const betId = String(formData.get("betId") ?? "");
  const validatedDifficulty = Number(formData.get("validatedDifficulty")) as BetDifficulty;
  const validatedCategory = String(formData.get("validatedCategory") ?? "") as BetCategory;

  const result = await validateBet({ betId, validatedDifficulty, validatedCategory });

  if (!result.success) {
    redirect(`/admin/validation?validationError=${encodeURIComponent(result.error)}&betId=${betId}`);
  }
  redirect("/admin/validation");
}

export async function rejectBetFormAction(formData: FormData): Promise<void> {
  const betId = String(formData.get("betId") ?? "");
  const refusalReason = String(formData.get("refusalReason") ?? "");

  const result = await rejectBet({ betId, refusalReason });

  if (!result.success) {
    redirect(`/admin/validation?validationError=${encodeURIComponent(result.error)}&betId=${betId}`);
  }
  redirect("/admin/validation");
}
