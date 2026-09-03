import { getServerClient } from "@/lib/supabase/server";
import { parisDateTimeLabel } from "@/lib/dates/paris";

// Lecture de la file des signalements de chat admin (03/09/2026, migration
// 20260903130000) — même patron que lib/queries/admin-bug-reports.ts :
// jointure pseudo faite séparément (2 requêtes), pas d'embed Supabase.
// L'auteur du message signalé peut être `null` (message_author_id sans
// contrainte not null) -- pas de cas connu à ce jour, mais pas d'hypothèse
// prise sur ce point.

export type ChatMessageReport = {
  reportId: string;
  reporterUserId: string;
  reporterPseudo: string;
  messageAuthorId: string | null;
  messageAuthorPseudo: string;
  messageBodySnapshot: string;
  messageStillExists: boolean;
  reason: string;
  createdAtLabel: string;
  status: "OPEN" | "RESOLVED";
  adminNote: string | null;
};

type ChatMessageReportRow = {
  id: string;
  message_id: string | null;
  message_body_snapshot: string;
  message_author_id: string | null;
  reporter_user_id: string;
  reason: string;
  status: "OPEN" | "RESOLVED";
  admin_note: string | null;
  created_at: string;
};

export async function getChatMessageReports(status: "OPEN" | "RESOLVED" = "OPEN"): Promise<ChatMessageReport[]> {
  const supabase = await getServerClient();

  const { data: reports } = await supabase
    .from("chat_message_reports")
    .select("id, message_id, message_body_snapshot, message_author_id, reporter_user_id, reason, status, admin_note, created_at")
    .eq("status", status)
    .order("created_at", { ascending: false });
  const rows = (reports ?? []) as ChatMessageReportRow[];
  if (rows.length === 0) return [];

  const userIds = [...new Set(rows.flatMap((row) => [row.reporter_user_id, row.message_author_id]).filter((id): id is string => id !== null))];
  const { data: users } = await supabase.from("users").select("id, pseudo").in("id", userIds);
  const pseudoById = new Map((users ?? []).map((u) => [u.id as string, u.pseudo as string]));

  return rows.map((row) => ({
    reportId: row.id,
    reporterUserId: row.reporter_user_id,
    reporterPseudo: pseudoById.get(row.reporter_user_id) ?? "—",
    messageAuthorId: row.message_author_id,
    messageAuthorPseudo: row.message_author_id ? pseudoById.get(row.message_author_id) ?? "—" : "—",
    messageBodySnapshot: row.message_body_snapshot,
    messageStillExists: row.message_id !== null,
    reason: row.reason,
    createdAtLabel: parisDateTimeLabel(row.created_at),
    status: row.status,
    adminNote: row.admin_note,
  }));
}
