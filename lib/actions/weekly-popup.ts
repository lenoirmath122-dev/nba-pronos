"use server";

import { getServerClient } from "@/lib/supabase/server";
import { toDisplayedPopup, userIdsInContent, type DisplayedPopup } from "@/lib/weeklyPopup/display";
import type { TokenUserInfo } from "@/lib/weeklyPopup/tokens";
import type { CurrentWeeklyPopup } from "@/lib/weeklyPopup/types";

// Popup hebdomadaire côté joueur (lot 5, PR 5). Lecture par la RPC
// `current_weekly_popup()` (security definer : weekly_popups n'a aucune policy
// joueur, plan §1.11), puis résolution des jetons de mention avec les pseudos
// courants. « Vu » en base, par joueur et non par appareil (plan §1.4).

export type MyWeeklyPopup = { popupId: string; weekEndDate: string; popup: DisplayedPopup };

export async function getMyWeeklyPopup(): Promise<MyWeeklyPopup | null> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc("current_weekly_popup");
  if (error || !data) return null;
  const current = data as CurrentWeeklyPopup;
  if (!current.id || !current.content) return null;

  const ids = userIdsInContent(current.content);
  const users = new Map<string, TokenUserInfo>();
  if (ids.length > 0) {
    const { data: rows, error: usersError } = await supabase
      .from("users")
      .select("id, pseudo, popup_mentions_opt_out")
      .in("id", ids);
    // Sans pseudos on n'affiche rien : mieux vaut pas de popup qu'un texte où
    // tout le monde serait « un ancien joueur » (elle reste non vue).
    if (usersError) return null;
    for (const row of (rows ?? []) as Array<{ id: string; pseudo: string; popup_mentions_opt_out: boolean }>) {
      users.set(row.id.toLowerCase(), { pseudo: row.pseudo, popupMentionsOptOut: row.popup_mentions_opt_out });
    }
  }

  return {
    popupId: current.id,
    weekEndDate: current.week_end_date,
    popup: toDisplayedPopup(current.content, users),
  };
}

/** Marque la popup comme vue pour le joueur de la session (idempotent). */
export async function markWeeklyPopupSeen(popupId: string): Promise<{ success: boolean }> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false };

  const { error } = await supabase
    .from("weekly_popup_views")
    .upsert({ popup_id: popupId, user_id: user.id }, { onConflict: "popup_id,user_id", ignoreDuplicates: true });
  return { success: !error };
}
