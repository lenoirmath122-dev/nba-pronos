import { getServerClient } from "@/lib/supabase/server";

/** Repères « vu / fermé » du joueur (table user_seen_state), pour amorcer le
 *  store client de la TabBar (lib/seen/store.ts). */
export async function getUserSeenState(): Promise<Record<string, string>> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data } = await supabase.from("user_seen_state").select("key, value").eq("user_id", user.id);
  const state: Record<string, string> = {};
  for (const row of (data ?? []) as { key: string; value: string }[]) state[row.key] = row.value;
  return state;
}
