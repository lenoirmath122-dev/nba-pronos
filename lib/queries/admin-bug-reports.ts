import { getServerClient } from "@/lib/supabase/server";
import { parisDateTimeLabel } from "@/lib/dates/paris";

// Lecture de la file des signalements admin (28/08/2026, migration #33) —
// même patron que lib/queries/admin-requests.ts : jointure pseudo faite
// séparément (2 requêtes), pas d'embed Supabase.

// p1-22 (feuille de route Phase 1) : plafond de sécurité, pas une vraie
// pagination — même patron qu'admin-logs.ts::LOG_LIMIT. RESOLVED grossit
// indéfiniment (aucune purge) contrairement à OPEN.
const REPORT_LIMIT = 200;

export type BugReport = {
  reportId: string;
  reporterUserId: string;
  reporterPseudo: string;
  description: string;
  screenPath: string | null;
  createdAtLabel: string;
  status: "OPEN" | "RESOLVED";
  adminNote: string | null;
};

type BugReportRow = {
  id: string;
  user_id: string;
  description: string;
  screen_path: string | null;
  status: "OPEN" | "RESOLVED";
  admin_note: string | null;
  created_at: string;
};

export async function getBugReports(status: "OPEN" | "RESOLVED" = "OPEN"): Promise<BugReport[]> {
  const supabase = await getServerClient();

  const { data: reports } = await supabase
    .from("bug_reports")
    .select("id, user_id, description, screen_path, status, admin_note, created_at")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(REPORT_LIMIT);
  const rows = (reports ?? []) as BugReportRow[];
  if (rows.length === 0) return [];

  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const { data: users } = await supabase.from("users").select("id, pseudo").in("id", userIds);
  const pseudoById = new Map((users ?? []).map((u) => [u.id as string, u.pseudo as string]));

  return rows.map((row) => ({
    reportId: row.id,
    reporterUserId: row.user_id,
    reporterPseudo: pseudoById.get(row.user_id) ?? "—",
    description: row.description,
    screenPath: row.screen_path,
    createdAtLabel: parisDateTimeLabel(row.created_at),
    status: row.status,
    adminNote: row.admin_note,
  }));
}
