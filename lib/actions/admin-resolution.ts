"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/actions/audit";
import { recomputeBet } from "@/lib/scoring/recompute";
import { toClientError } from "@/lib/actions/errors";

// Écriture de la file de résolution (SPEC_ECRAN_ADMIN_RESOLUTION_V0_1 §4).
// Catégorie B AVEC recompute (T6a §5.3) : transition bets en session admin
// (RLS bets_update_admin), PUIS recomputeBet (lib/scoring/recompute.ts,
// service_role en interne) — écrit réellement points_awarded.

export type ActionResult = { success: true } | { success: false; error: string };

export async function resolveBet(input: {
  betId: string;
  outcome: "WON" | "LOST";
  resolutionReason?: string;
}): Promise<ActionResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  // Motif obligatoire si une requête de correction PENDING existe déjà sur
  // ce pari précis (§0/§2 de la spec — "contesté").
  const { count: pendingRequestCount } = await supabase
    .from("correction_requests")
    .select("id", { count: "exact", head: true })
    .eq("target_bet_id", input.betId)
    .eq("status", "PENDING");
  const reason = (input.resolutionReason ?? "").trim();
  if ((pendingRequestCount ?? 0) > 0 && reason.length === 0) {
    return { success: false, error: "Un motif est obligatoire pour un pari contesté." };
  }

  const { data: updated, error } = await supabase
    .from("bets")
    .update({
      status: input.outcome,
      resolution_reason: reason.length > 0 ? reason : null,
      resolved_at: new Date().toISOString(),
      resolved_by_admin_id: user.id,
    })
    .eq("id", input.betId)
    .eq("status", "VALIDATED")
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: toClientError("resolveBet", error) };
  if (!updated) return { success: false, error: "Ce pari a déjà été résolu." };

  await recomputeBet(input.betId);

  await logAdminAction(supabase, {
    actorUserId: user.id,
    action: "RESOLVE_BET",
    targetType: "bet",
    targetId: input.betId,
    reason: reason.length > 0 ? reason : undefined,
    after: { outcome: input.outcome },
  });

  revalidatePath("/admin/resolution");
  revalidatePath("/admin");
  return { success: true };
}

/**
 * Variante `<form action={...}>` NATIVE : FormData brut, appel de l'action,
 * puis REDIRECTION — même patron que lib/actions/admin-validation.ts.
 */
export async function resolveBetFormAction(formData: FormData): Promise<void> {
  const betId = String(formData.get("betId") ?? "");
  const outcome = String(formData.get("outcome") ?? "") as "WON" | "LOST";
  const resolutionReason = String(formData.get("resolutionReason") ?? "");

  const result = await resolveBet({ betId, outcome, resolutionReason });

  if (!result.success) {
    redirect(`/admin/resolution?resolutionError=${encodeURIComponent(result.error)}&betId=${betId}`);
  }
  redirect("/admin/resolution");
}
