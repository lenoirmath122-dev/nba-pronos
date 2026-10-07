import type { getServerClient } from "@/lib/supabase/server";
import { isDailyDayPublished, slotToNyDay } from "@/lib/dates/paris";

// Masquage côté joueur des matchs du « Match du jour » dont le jour NY n'est
// pas encore publié (fenêtre glissante : 10h Paris le D-6, voir
// lib/dates/paris.ts::dailyPublishAt). La RLS laisse
// tout visible (décision du 07/10/2026 : filtre JS, pas de migration RLS) :
// ce filtre ne protège donc que les écrans qui l'appliquent — la seule
// conséquence d'une fuite (temps réel, REST) est de lire un match avant 10h.
// Ne touche jamais les séries Playoffs/Cup : seule `round = 'DAILY'` est lue.

type SupabaseServerClient = Awaited<ReturnType<typeof getServerClient>>;

// UUID nul : valeur de remplissage pour que `not in (...)` ne soit jamais vide.
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

/** Séries DAILY non publiées à `nowMs` (pur, testé). */
export function unpublishedDailySeriesIds(rows: { id: string; slot_index: number }[], nowMs: number): string[] {
  return rows.filter((r) => !isDailyDayPublished(slotToNyDay(r.slot_index), nowMs)).map((r) => r.id);
}

/** Valeur `(id1,id2,...)` pour `.not("series_id", "in", <valeur>)` : exclut les
 *  matchs des jours non publiés. Une requête légère (≤ ~40 séries DAILY). */
export async function hiddenSeriesFilter(supabase: SupabaseServerClient, nowMs: number = Date.now()): Promise<string> {
  const { data } = await supabase.from("series").select("id, slot_index").eq("round", "DAILY");
  const ids = unpublishedDailySeriesIds((data ?? []) as { id: string; slot_index: number }[], nowMs);
  return `(${[NIL_UUID, ...ids].join(",")})`;
}

/** Vrai si ce match appartient à un jour DAILY non publié (garde des actions). */
export async function isMatchHiddenByPublication(
  supabase: SupabaseServerClient,
  seriesId: string,
  nowMs: number = Date.now()
): Promise<boolean> {
  const { data } = await supabase.from("series").select("id, round, slot_index").eq("id", seriesId).maybeSingle();
  if (!data || data.round !== "DAILY") return false;
  return unpublishedDailySeriesIds([{ id: data.id as string, slot_index: data.slot_index as number }], nowMs).length > 0;
}
