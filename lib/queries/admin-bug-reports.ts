import { getServerClient } from "@/lib/supabase/server";
import { parisDateTimeLabel } from "@/lib/dates/paris";

// Lecture de la file des signalements admin (28/08/2026, migration #33) —
// même patron que lib/queries/admin-requests.ts : jointure pseudo faite
// séparément (2 requêtes), pas d'embed Supabase.

// p1-22 (feuille de route Phase 1) : vraie pagination, même patron que
// admin-logs.ts::getAuditLogs. RESOLVED grossit indéfiniment (aucune purge)
// contrairement à OPEN.
const REPORT_LIMIT = 200;

export type BugReportsPage = { reports: BugReport[]; hasMore: boolean };

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

export async function getBugReports(status: "OPEN" | "RESOLVED" = "OPEN", page = 1): Promise<BugReportsPage> {
  const supabase = await getServerClient();

  const offset = (Math.max(1, page) - 1) * REPORT_LIMIT;
  const { data: reports } = await supabase
    .from("bug_reports")
    .select("id, user_id, description, screen_path, status, admin_note, created_at")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .range(offset, offset + REPORT_LIMIT);
  const fetched = (reports ?? []) as BugReportRow[];
  const hasMore = fetched.length > REPORT_LIMIT;
  const rows = hasMore ? fetched.slice(0, REPORT_LIMIT) : fetched;
  if (rows.length === 0) return { reports: [], hasMore: false };

  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const { data: users } = await supabase.from("users").select("id, pseudo").in("id", userIds);
  const pseudoById = new Map((users ?? []).map((u) => [u.id as string, u.pseudo as string]));

  return {
    reports: rows.map((row) => ({
      reportId: row.id,
      reporterUserId: row.user_id,
      reporterPseudo: pseudoById.get(row.user_id) ?? "—",
      description: row.description,
      screenPath: row.screen_path,
      createdAtLabel: parisDateTimeLabel(row.created_at),
      status: row.status,
      adminNote: row.admin_note,
    })),
    hasMore,
  };
}
