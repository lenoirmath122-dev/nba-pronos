import type { getServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof getServerClient>>;

/** `competitions.weekly_ranking`, lu à part et de façon tolérante : colonne
 *  absente (migration 20261012090000 pas poussée) ou toute autre erreur de
 *  lecture = false, l'écran garde son comportement historique plutôt que de
 *  planter. Ne jamais ajouter la colonne au `select` d'une requête existante. */
export async function readWeeklyRankingFlag(
  supabase: SupabaseServerClient,
  competitionId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("competitions")
    .select("weekly_ranking")
    .eq("id", competitionId)
    .maybeSingle<{ weekly_ranking: boolean }>();
  if (error) return false;
  return data?.weekly_ranking === true;
}
