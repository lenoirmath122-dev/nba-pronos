import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

// Reprise automatique après inscription : /rejoindre/<code> (visiteur) pose ce
// cookie, la 1re connexion (mot de passe, lien magique, Google) rejoint la
// ligue puis l'efface. Limite : e-mail confirmé sur un autre appareil = pas de
// cookie, le joueur colle alors le code à la main (Profil > Ligues).

export const PENDING_LEAGUE_COOKIE = "pb_join";
export const PENDING_LEAGUE_MAX_AGE = 60 * 60 * 24 * 7;

/** Rejoint la ligue en attente (si cookie) et l'efface. Renvoie l'id du canal, ou null. */
export async function consumePendingLeague(supabase: SupabaseClient): Promise<string | null> {
  const store = await cookies();
  const code = store.get(PENDING_LEAGUE_COOKIE)?.value;
  if (!code) return null;
  store.delete(PENDING_LEAGUE_COOKIE);
  const { data, error } = await supabase.rpc("join_league", { p_code: code }).single<{ id: string }>();
  return data && !error ? data.id : null;
}
