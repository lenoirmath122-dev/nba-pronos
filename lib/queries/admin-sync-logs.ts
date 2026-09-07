import { getServerClient } from "@/lib/supabase/server";

// Lecture de sync_logs (p1-6, feuille de route Phase 1) -- écrit par les 4
// routes de synchro (app/api/sync/teams|schedule|results, plus le heartbeat,
// via lib/sync/logging.ts::writeSyncLog) mais jamais lu par personne jusqu'ici
// (GAPS_OUVERTS.md). Écran de CONSULTATION PURE, même patron que
// lib/queries/admin-logs.ts (audit_logs) : RLS synclogs_select = is_admin()
// (migration #3), lecture directe via getServerClient.

const LOG_LIMIT = 100;

export type SyncType = "TEAMS" | "SCHEDULE" | "RESULTS" | "HEARTBEAT";

export const SYNC_TYPE_LABELS: Record<SyncType, string> = {
  TEAMS: "Équipes",
  SCHEDULE: "Calendrier",
  RESULTS: "Résultats",
  HEARTBEAT: "Heartbeat",
};

export type SyncLogRow = {
  id: string;
  createdAt: string;
  syncType: SyncType;
  endpoint: string | null;
  success: boolean;
  summary: string | null;
  requestsRemaining: number | null;
};

export type SyncLogFilters = { syncType?: string; failedOnly?: boolean };

type LogRecord = {
  id: string;
  created_at: string;
  sync_type: SyncType;
  endpoint: string | null;
  success: boolean;
  summary: string | null;
  requests_remaining: number | null;
};

export async function getSyncLogs(filters: SyncLogFilters): Promise<SyncLogRow[]> {
  const supabase = await getServerClient();

  let query = supabase
    .from("sync_logs")
    .select("id, created_at, sync_type, endpoint, success, summary, requests_remaining")
    .order("created_at", { ascending: false })
    .limit(LOG_LIMIT);

  if (filters.syncType) query = query.eq("sync_type", filters.syncType);
  if (filters.failedOnly) query = query.eq("success", false);

  const { data } = await query;
  const logs = (data ?? []) as LogRecord[];

  return logs.map((log) => ({
    id: log.id,
    createdAt: log.created_at,
    syncType: log.sync_type,
    endpoint: log.endpoint,
    success: log.success,
    summary: log.summary,
    requestsRemaining: log.requests_remaining,
  }));
}

/** Dernière lecture connue du quota Highlightly (p1-7, feuille de route
 *  Phase 1) -- requests_remaining est déjà écrit à chaque synchro
 *  (lib/sync/logging.ts) mais restait noyé ligne par ligne dans la liste
 *  ci-dessus, jamais mis en avant. `null` si aucune synchro n'a encore
 *  renvoyé de valeur (ex. base tout juste initialisée). */
export async function getLatestHighlightlyQuota(): Promise<{ requestsRemaining: number; createdAt: string } | null> {
  const supabase = await getServerClient();
  const { data } = await supabase
    .from("sync_logs")
    .select("created_at, requests_remaining")
    .not("requests_remaining", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ created_at: string; requests_remaining: number }>();
  return data ? { requestsRemaining: data.requests_remaining, createdAt: data.created_at } : null;
}
