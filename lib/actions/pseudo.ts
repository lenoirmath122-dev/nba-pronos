"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/actions/audit";
import { toClientError } from "@/lib/actions/errors";
import { notifyPseudoDecision } from "@/lib/push/notifyPseudoDecision";
import { normalizePseudo, pseudoLengthError, PSEUDO_RPC_MESSAGES } from "@/lib/pseudo/rules";

// Changement de pseudo avec validation admin (migration 20261014090000).
// Les règles et l'atomicité vivent dans les fonctions SQL ; ces actions
// traduisent leur code de retour. Même patron formulaire natif + redirection
// que lib/actions/profile.ts.

const MAX_REASON_LENGTH = 300;

function profileRedirect(params: Record<string, string>): never {
  redirect(`/profile/pseudo?${new URLSearchParams(params).toString()}`);
}

export async function requestPseudoChangeFormAction(formData: FormData): Promise<void> {
  const pseudo = normalizePseudo(String(formData.get("pseudo") ?? ""));
  const lengthError = pseudoLengthError(pseudo);
  if (lengthError) profileRedirect({ pseudoError: lengthError });

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("request_pseudo_change", { p_new: pseudo });
  if (error) profileRedirect({ pseudoError: toClientError("requestPseudoChange", error) });

  const code = String(data);
  if (code !== "OK") {
    profileRedirect({ pseudoError: PSEUDO_RPC_MESSAGES[code] ?? "Demande impossible pour le moment." });
  }

  revalidatePath("/profile/pseudo");
  profileRedirect({ pseudoSent: "1" });
}

function adminRedirect(requestId: string, error: string): never {
  const qs = new URLSearchParams({ pseudoError: error, requestId });
  redirect(`/admin/pseudo?${qs.toString()}`);
}

type PendingRow = { user_id: string; requested_pseudo: string; old_pseudo: string };

async function loadRequest(requestId: string): Promise<PendingRow | null> {
  const supabase = await getServerClient();
  const { data } = await supabase
    .from("pseudo_change_requests")
    .select("user_id, requested_pseudo, old_pseudo")
    .eq("id", requestId)
    .maybeSingle<PendingRow>();
  return data ?? null;
}

export async function approvePseudoChangeFormAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get("requestId") ?? "");
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const request = await loadRequest(requestId);
  const { data, error } = await supabase.rpc("approve_pseudo_change", { p_request_id: requestId });
  if (error) adminRedirect(requestId, toClientError("approvePseudoChange", error));
  const code = String(data);
  if (code !== "OK") adminRedirect(requestId, PSEUDO_RPC_MESSAGES[code] ?? "Action impossible.");

  if (request) {
    await logAdminAction(supabase, {
      actorUserId: user.id,
      action: "PSEUDO_CHANGE_APPROVED",
      targetType: "user",
      targetId: request.user_id,
      before: { pseudo: request.old_pseudo },
      after: { pseudo: request.requested_pseudo },
    });
    await notifyPseudoDecision({ userId: request.user_id, approved: true, newPseudo: request.requested_pseudo });
  }

  revalidatePath("/admin/pseudo");
  revalidatePath("/admin");
  redirect("/admin/pseudo");
}

export async function rejectPseudoChangeFormAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get("requestId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, MAX_REASON_LENGTH);

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const request = await loadRequest(requestId);
  const { data, error } = await supabase.rpc("reject_pseudo_change", {
    p_request_id: requestId,
    p_reason: reason,
  });
  if (error) adminRedirect(requestId, toClientError("rejectPseudoChange", error));
  const code = String(data);
  if (code !== "OK") adminRedirect(requestId, PSEUDO_RPC_MESSAGES[code] ?? "Action impossible.");

  if (request) {
    await logAdminAction(supabase, {
      actorUserId: user.id,
      action: "PSEUDO_CHANGE_REJECTED",
      targetType: "user",
      targetId: request.user_id,
      reason: reason || undefined,
      before: { pseudo: request.old_pseudo },
      after: { requested: request.requested_pseudo },
    });
    await notifyPseudoDecision({ userId: request.user_id, approved: false, newPseudo: request.requested_pseudo });
  }

  revalidatePath("/admin/pseudo");
  revalidatePath("/admin");
  redirect("/admin/pseudo");
}
