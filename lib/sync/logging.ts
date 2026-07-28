import { getServiceClient } from "@/lib/supabase/service";

// Écriture partagée de sync_logs (B3) — appelée par chacune des 4 routes,
// même patron que lib/actions/audit.ts::logAdminAction (best-effort : un
// échec d'écriture du log ne doit jamais faire échouer la passe de synchro
// elle-même, qui est déjà terminée au moment où on journalise).
export async function writeSyncLog(
  supabase: ReturnType<typeof getServiceClient>,
  input: {
    syncType: "TEAMS" | "SCHEDULE" | "RESULTS" | "HEARTBEAT";
    endpoint: string | null;
    success: boolean;
    summary: string;
    requestsRemaining: number | null;
  }
): Promise<void> {
  const { error } = await supabase.from("sync_logs").insert({
    sync_type: input.syncType,
    endpoint: input.endpoint,
    success: input.success,
    summary: input.summary,
    requests_remaining: input.requestsRemaining,
  });
  if (error) {
    console.error(`writeSyncLog a échoué pour ${input.syncType} :`, error.message);
  }
}
