"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/actions/audit";
import { recomputeMatch, recomputeBet } from "@/lib/scoring/recompute";

// Écriture de la file des requêtes (SPEC_ECRAN_ADMIN_REQUESTS_V0_1 §4).
// RLS cr_update_admin (is_admin() ET requester_user_id <> auth.uid()) —
// un admin ne peut PAS traiter sa propre requête, déjà bloqué en base.

export type ActionResult = { success: true } | { success: false; error: string };

type RequestRow = {
  id: string;
  status: string;
  target_type: "MATCH_PREDICTION" | "BET";
  target_match_prediction_id: string | null;
  target_bet_id: string | null;
};

type NewBetStatus = "VALIDATED" | "WON" | "LOST" | "REJECTED";

export async function processCorrectionRequest(input: {
  requestId: string;
  correctedWinnerTeamId?: string;
  correctedMargin?: number;
  reason?: string;
  /** BET uniquement, réservé au cas "pari contesté" (migration #13) — un
   *  pari VALIDATED jamais résolu (cas d'origine) n'en a pas besoin, il
   *  reste réservé à /admin/resolution, comportement inchangé. */
  newBetStatus?: NewBetStatus;
  /** Requis SI le pari n'a jamais eu de validated_difficulty (refusé avant
   *  toute validation) ET que newBetStatus n'est pas REJECTED. */
  newBetDifficulty?: number;
}): Promise<ActionResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const { data: request, error: requestErr } = await supabase
    .from("correction_requests")
    .select("id, status, target_type, target_match_prediction_id, target_bet_id")
    .eq("id", input.requestId)
    .single<RequestRow>();
  if (requestErr || !request) return { success: false, error: "Requête introuvable." };
  if (request.status !== "PENDING") return { success: false, error: "Cette requête a déjà été traitée." };

  const reason = (input.reason ?? "").trim();

  if (request.target_type === "MATCH_PREDICTION") {
    if (!input.correctedWinnerTeamId || input.correctedMargin === undefined) {
      return { success: false, error: "Vainqueur et écart corrigés sont obligatoires." };
    }

    const { data: prediction } = await supabase
      .from("match_predictions")
      .select("match_id")
      .eq("id", request.target_match_prediction_id as string)
      .single<{ match_id: string }>();
    if (!prediction) return { success: false, error: "Prono introuvable." };

    // Trigger enforce_prediction_correction (T-c) re-vérifie admin != auteur
    // ET correction_request_id renseigné — garde réelle en base.
    const { error: predictionErr } = await supabase
      .from("match_predictions")
      .update({
        predicted_winner_team_id: input.correctedWinnerTeamId,
        predicted_margin: input.correctedMargin,
        is_admin_corrected: true,
        corrected_by_admin_id: user.id,
        correction_request_id: request.id,
        correction_reason: reason.length > 0 ? reason : null,
      })
      .eq("id", request.target_match_prediction_id as string);
    if (predictionErr) return { success: false, error: predictionErr.message };

    await recomputeMatch(prediction.match_id);
  } else {
    // BET : deux cas distincts, réunis dans le même écran depuis la
    // migration #13.
    // (a) newBetStatus fourni (pari REJETÉ/déjà résolu, contesté) : l'admin
    //     tranche directement ici — trigger enforce_bet_transitions (admin
    //     != auteur, correction_request_id requis) fait foi, PUIS recompute.
    // (b) newBetStatus absent (pari VALIDATED jamais résolu, cas d'origine
    //     de la migration #11) : comportement INCHANGÉ — marquage de
    //     transparence seulement, la vraie résolution reste sur
    //     /admin/resolution.
    const betUpdate: Record<string, unknown> = {
      is_admin_corrected: true,
      corrected_by_admin_id: user.id,
      correction_request_id: request.id,
      correction_reason: reason.length > 0 ? reason : null,
    };
    if (input.newBetStatus) {
      betUpdate.status = input.newBetStatus;
      if (input.newBetStatus !== "REJECTED" && input.newBetDifficulty !== undefined) {
        betUpdate.validated_difficulty = input.newBetDifficulty;
      }
    }

    const { error: betErr } = await supabase.from("bets").update(betUpdate).eq("id", request.target_bet_id as string);
    if (betErr) return { success: false, error: betErr.message };

    if (input.newBetStatus) {
      await recomputeBet(request.target_bet_id as string);
    }
  }

  const { data: updated, error: closeErr } = await supabase
    .from("correction_requests")
    .update({ status: "PROCESSED", handled_by_admin_id: user.id, handled_at: new Date().toISOString() })
    .eq("id", request.id)
    .eq("status", "PENDING")
    .select("id")
    .maybeSingle();
  if (closeErr) return { success: false, error: closeErr.message };
  if (!updated) return { success: false, error: "Cette requête a déjà été traitée." };

  await logAdminAction(supabase, {
    actorUserId: user.id,
    action: "PROCESS_CORRECTION_REQUEST",
    targetType: request.target_type === "MATCH_PREDICTION" ? "match_prediction" : "bet",
    targetId: (request.target_match_prediction_id ?? request.target_bet_id) as string,
    reason: reason.length > 0 ? reason : undefined,
  });

  revalidatePath("/admin/requests");
  revalidatePath("/admin");
  return { success: true };
}

export async function rejectCorrectionRequest(input: { requestId: string; reason: string }): Promise<ActionResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const reason = input.reason.trim();
  if (reason.length === 0) return { success: false, error: "Un motif est obligatoire pour refuser une requête." };

  const { data: updated, error } = await supabase
    .from("correction_requests")
    .update({ status: "REJECTED", admin_reason: reason, handled_by_admin_id: user.id, handled_at: new Date().toISOString() })
    .eq("id", input.requestId)
    .eq("status", "PENDING")
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!updated) return { success: false, error: "Cette requête a déjà été traitée." };

  await logAdminAction(supabase, {
    actorUserId: user.id,
    action: "REJECT_CORRECTION_REQUEST",
    targetType: "correction_request",
    targetId: input.requestId,
    reason,
  });

  revalidatePath("/admin/requests");
  revalidatePath("/admin");
  return { success: true };
}

/**
 * Variantes `<form action={...}>` NATIVES : FormData brut, appel de
 * l'action, puis REDIRECTION — même patron que les lots précédents.
 */
export async function processCorrectionRequestFormAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get("requestId") ?? "");
  const correctedWinnerTeamIdRaw = formData.get("correctedWinnerTeamId");
  const correctedMarginRaw = formData.get("correctedMargin");
  const reason = String(formData.get("reason") ?? "");
  const newBetStatusRaw = formData.get("newBetStatus");
  const newBetDifficultyRaw = formData.get("newBetDifficulty");

  const result = await processCorrectionRequest({
    requestId,
    correctedWinnerTeamId: correctedWinnerTeamIdRaw ? String(correctedWinnerTeamIdRaw) : undefined,
    correctedMargin: correctedMarginRaw ? Number(correctedMarginRaw) : undefined,
    reason,
    newBetStatus: newBetStatusRaw ? (String(newBetStatusRaw) as "VALIDATED" | "WON" | "LOST" | "REJECTED") : undefined,
    newBetDifficulty: newBetDifficultyRaw ? Number(newBetDifficultyRaw) : undefined,
  });

  if (!result.success) {
    redirect(`/admin/requests?requestsError=${encodeURIComponent(result.error)}&requestId=${requestId}`);
  }
  redirect("/admin/requests");
}

export async function rejectCorrectionRequestFormAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get("requestId") ?? "");
  const reason = String(formData.get("reason") ?? "");

  const result = await rejectCorrectionRequest({ requestId, reason });

  if (!result.success) {
    redirect(`/admin/requests?requestsError=${encodeURIComponent(result.error)}&requestId=${requestId}`);
  }
  redirect("/admin/requests");
}
