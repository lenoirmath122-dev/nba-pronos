"use server";

import { getServerClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/actions/audit";

// Bouton « Lancer l'import des box scores » (admin > Système) : déclenche le
// workflow GitHub `run-stats-import-vm.yml` (import sur la VM nba-refresh).
// Le workflow doit tourner sur `main` : la liaison Workload Identity Federation
// du compte de service est limitée à cette branche.
// Variable d'environnement requise : GITHUB_DISPATCH_TOKEN (jeton fine-grained,
// dépôt nba-pronos uniquement, permission « Actions : Read and write »).

export type TriggerStatsImportResult = { success: true } | { success: false; error: string };

const REPO = "lenoirmath122-dev/nba-pronos";
const WORKFLOW_FILE = "run-stats-import-vm.yml";
const MODES = ["manuel", "presaison"] as const;
type ImportMode = (typeof MODES)[number];

export async function triggerStatsImport(mode: string): Promise<TriggerStatsImportResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { success: false, error: "Réservé aux admins." };

  // Liste fermée : le mode finit en argument d'une commande SSH côté workflow.
  if (!(MODES as readonly string[]).includes(mode)) return { success: false, error: "Mode invalide." };

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return { success: false, error: "GITHUB_DISPATCH_TOKEN n'est pas configuré sur le serveur." };

  let response: Response;
  try {
    response = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main", inputs: { mode: mode as ImportMode } }),
      cache: "no-store",
    });
  } catch {
    return { success: false, error: "GitHub est injoignable." };
  }

  // 204 No Content = déclenché.
  if (response.status !== 204) {
    console.error(`triggerStatsImport : GitHub a répondu ${response.status}`);
    return { success: false, error: `GitHub a refusé le lancement (HTTP ${response.status}).` };
  }

  await logAdminAction(supabase, {
    actorUserId: user.id,
    action: "TRIGGER_STATS_IMPORT",
    targetType: "stats_import",
    targetId: user.id,
    reason: mode,
  });

  return { success: true };
}
