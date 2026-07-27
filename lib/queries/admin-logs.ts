import { getServerClient } from "@/lib/supabase/server";
import { adminActionLabel } from "@/lib/labels/audit";
import { parisDayBoundsUtc } from "@/lib/dates/paris";

// Lecture de l'écran Historique des logs (SPEC_ECRAN_ADMIN_LOGS_V0_1
// §3/§4). Écran de CONSULTATION PURE — aucune écriture. RLS audit_select =
// is_admin() (migration #3), lecture directe via getServerClient.

const LOG_LIMIT = 100;

export type AuditLogRow = {
  id: string;
  createdAt: string;
  actorPseudo: string;
  action: string;
  actionLabel: string;
  targetType: string;
  targetId: string | null;
  targetPseudo: string | null;
  reason: string | null;
  beforeValue: unknown;
  afterValue: unknown;
};

export type AuditLogFilters = { action?: string; actorUserId?: string; date?: string };

export type AuditLogFilterOptions = {
  actions: { value: string; label: string }[];
  actors: { value: string; label: string }[];
};

type LogRecord = {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  reason: string | null;
  before_value: unknown;
  after_value: unknown;
  created_at: string;
};

export async function getAuditLogs(filters: AuditLogFilters): Promise<AuditLogRow[]> {
  const supabase = await getServerClient();

  let query = supabase
    .from("audit_logs")
    .select("id, actor_user_id, action, target_type, target_id, reason, before_value, after_value, created_at")
    .order("created_at", { ascending: false })
    .limit(LOG_LIMIT);

  if (filters.action) query = query.eq("action", filters.action);
  if (filters.actorUserId) query = query.eq("actor_user_id", filters.actorUserId);
  if (filters.date) {
    const { startIso, endIsoExclusive } = parisDayBoundsUtc(filters.date);
    query = query.gte("created_at", startIso).lt("created_at", endIsoExclusive);
  }

  const { data } = await query;
  const logs = (data ?? []) as LogRecord[];
  if (logs.length === 0) return [];

  // Résout acteur + cible "user" en un seul aller — SEUL target_type "user"
  // est enrichi d'un pseudo (§2 : "bet" resterait un id brut, jointures non
  // justifiées pour un écran d'audit).
  const userIds = new Set<string>();
  for (const log of logs) {
    if (log.actor_user_id) userIds.add(log.actor_user_id);
    if (log.target_type === "user" && log.target_id) userIds.add(log.target_id);
  }
  const { data: usersData } =
    userIds.size > 0
      ? await supabase.from("users").select("id, pseudo").in("id", [...userIds])
      : { data: [] as { id: string; pseudo: string }[] };
  const pseudoById = new Map((usersData ?? []).map((u) => [u.id as string, u.pseudo as string]));

  return logs.map((log) => ({
    id: log.id,
    createdAt: log.created_at,
    actorPseudo: log.actor_user_id ? (pseudoById.get(log.actor_user_id) ?? "—") : "Système",
    action: log.action,
    actionLabel: adminActionLabel(log.action),
    targetType: log.target_type,
    targetId: log.target_id,
    targetPseudo: log.target_type === "user" && log.target_id ? (pseudoById.get(log.target_id) ?? null) : null,
    reason: log.reason,
    beforeValue: log.before_value,
    afterValue: log.after_value,
  }));
}

export async function getAuditLogFilterOptions(): Promise<AuditLogFilterOptions> {
  const supabase = await getServerClient();

  const { data } = await supabase.from("audit_logs").select("action, actor_user_id");
  const rows = (data ?? []) as { action: string; actor_user_id: string | null }[];

  const distinctActions = [...new Set(rows.map((r) => r.action))].sort();
  const distinctActorIds = [...new Set(rows.map((r) => r.actor_user_id).filter((id): id is string => id !== null))];

  const { data: usersData } =
    distinctActorIds.length > 0
      ? await supabase.from("users").select("id, pseudo").in("id", distinctActorIds)
      : { data: [] as { id: string; pseudo: string }[] };
  const pseudoById = new Map((usersData ?? []).map((u) => [u.id as string, u.pseudo as string]));

  return {
    actions: distinctActions.map((a) => ({ value: a, label: adminActionLabel(a) })),
    actors: distinctActorIds
      .map((id) => ({ value: id, label: pseudoById.get(id) ?? "—" }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };
}
