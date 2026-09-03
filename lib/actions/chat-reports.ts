"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { toClientError } from "@/lib/actions/errors";
import { requiredBoundedText } from "@/lib/actions/validation";

// Signalement d'un message de chat vers les admins (03/09/2026, migration
// 20260903130000, cadrage juridique §2.10 point 7) -- même structure que
// lib/actions/bug-reports.ts : submitChatMessageReport (joueur, useTransition
// depuis ReportMessageButton) + resolveChatMessageReportFormAction (admin,
// formulaire natif + redirection).

export type ActionResult = { success: true } | { success: false; error: string };

const MAX_REASON_LENGTH = 500;
const ReasonSchema = requiredBoundedText(MAX_REASON_LENGTH);

export async function submitChatMessageReport(input: {
  messageId: string;
  reason: string;
}): Promise<ActionResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const parsed = ReasonSchema.safeParse(input.reason);
  if (!parsed.success) {
    const tooLong = input.reason.trim().length > MAX_REASON_LENGTH;
    return { success: false, error: tooLong ? `${MAX_REASON_LENGTH} caractères maximum.` : "Explique brièvement le problème avant d'envoyer." };
  }
  const reason = parsed.data;

  // Snapshot constitué ici, PAS envoyé par le client (chat_message_reports_
  // insert, migration 20260903130000) -- le message est relu via
  // chat_messages_select (RLS déjà en vigueur : Général ouvert, ligue
  // réservée aux membres), donc un joueur ne peut signaler que ce qu'il
  // pouvait déjà lire.
  const { data: message, error: messageError } = await supabase
    .from("chat_messages")
    .select("id, body, user_id")
    .eq("id", input.messageId)
    .maybeSingle<{ id: string; body: string; user_id: string }>();
  if (messageError) return { success: false, error: toClientError("submitChatMessageReport/read", messageError) };
  if (!message) return { success: false, error: "Ce message n'existe plus ou n'est pas accessible." };

  const { error } = await supabase.from("chat_message_reports").insert({
    message_id: message.id,
    message_body_snapshot: message.body,
    message_author_id: message.user_id,
    reporter_user_id: user.id,
    reason,
  });
  if (error) return { success: false, error: toClientError("submitChatMessageReport/insert", error) };

  revalidatePath("/admin/chat-reports");
  return { success: true };
}

/**
 * Formulaire natif admin (marquer résolu, note optionnelle) — même patron
 * FormData brut + redirection que resolveBugReportFormAction.
 */
export async function resolveChatMessageReportFormAction(formData: FormData): Promise<void> {
  const reportId = String(formData.get("reportId") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim();

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect(`/admin/chat-reports?reportId=${reportId}&chatReportError=${encodeURIComponent("Réservé aux admins.")}`);

  const { data: updated, error } = await supabase
    .from("chat_message_reports")
    .update({
      status: "RESOLVED",
      admin_note: adminNote.length > 0 ? adminNote : null,
      resolved_at: new Date().toISOString(),
      resolved_by_admin_id: user!.id,
    })
    .eq("id", reportId)
    .select("id")
    .maybeSingle();

  if (error) {
    redirect(`/admin/chat-reports?reportId=${reportId}&chatReportError=${encodeURIComponent(toClientError("resolveChatMessageReportFormAction", error))}`);
  }
  if (!updated) {
    redirect(`/admin/chat-reports?reportId=${reportId}&chatReportError=${encodeURIComponent("Aucune ligne modifiée.")}`);
  }

  revalidatePath("/admin/chat-reports");
  redirect("/admin/chat-reports");
}
