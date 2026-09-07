import { getServiceClient } from "@/lib/supabase/service";

// Écriture partagée de sync_logs (B3) — appelée par chacune des 4 routes,
// même patron que lib/actions/audit.ts::logAdminAction (best-effort : un
// échec d'écriture du log ne doit jamais faire échouer la passe de synchro
// elle-même, qui est déjà terminée au moment où on journalise).

// Correctif post-audit (28/07/2026, GAPS_OUVERTS.md) : SPEC_TECHNIQUE_SYNCHRO_V0.1
// §3 promet un avertissement journalisé quand le quota approche de 0, jamais
// implémenté. "Proche de 0" n'est pas chiffré par la spec (quota 100/jour, §2
// du doc maître) — seuil choisi ici, 10% du quota journalier, pas un choix
// produit : à ajuster si un vrai épuisement de quota est observé en usage.
export const LOW_QUOTA_THRESHOLD = 10;

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
  let summary = input.summary;
  if (input.requestsRemaining !== null && input.requestsRemaining <= LOW_QUOTA_THRESHOLD) {
    const warning = `⚠️ Quota API Highlightly bas (${input.requestsRemaining} requête(s) restante(s) aujourd'hui).`;
    summary = `${warning} ${summary}`;
    console.warn(`writeSyncLog (${input.syncType}) : ${warning}`);
  }

  const { error } = await supabase.from("sync_logs").insert({
    sync_type: input.syncType,
    endpoint: input.endpoint,
    success: input.success,
    summary,
    requests_remaining: input.requestsRemaining,
  });
  if (error) {
    console.error(`writeSyncLog a échoué pour ${input.syncType} :`, error.message);
  }
}
