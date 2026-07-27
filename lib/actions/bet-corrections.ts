"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";

// SEULE écriture de l'écran Mes paris (SPEC_ECRAN_MES_PARIS_V0_1 §8). Appelle
// la fonction SQL SECURITY DEFINER de la migration #11 via .rpc() — AUCUNE
// écriture directe sur correction_requests : les garde-fous (propriétaire,
// joueur ACTIF, pari VALIDATED, cible FINISHED, justification obligatoire,
// une seule requête PENDING) vivent dans la fonction, côté base, jamais ici.
// Session utilisateur uniquement (getServerClient, jamais service_role).

export type ActionResult = { success: true } | { success: false; error: string };

export async function requestBetCorrection(input: { betId: string; justification: string }): Promise<ActionResult> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const { error } = await supabase.rpc("request_bet_correction", {
    p_bet: input.betId,
    p_justification: input.justification,
  });

  if (error) {
    // Les messages levés par la fonction (migration #11) sont déjà rédigés
    // pour le joueur — on les remonte tels quels plutôt que d'inventer un
    // message générique qui masquerait la vraie raison du refus.
    return { success: false, error: error.message };
  }

  revalidatePath("/play/bets");
  return { success: true };
}

/**
 * Variante `<form action={...}>` NATIVE (aucun JS) : reçoit un FormData brut,
 * appelle requestBetCorrection(), puis REDIRIGE — un formulaire sans JS ne
 * peut pas lire une valeur de retour, l'erreur est donc portée par l'URL de
 * la redirection, jamais par un état client. Même patron que
 * requestPredictionCorrectionFormAction (lib/actions/corrections.ts).
 */
export async function requestBetCorrectionFormAction(formData: FormData): Promise<void> {
  const betId = String(formData.get("betId") ?? "");
  const justification = String(formData.get("justification") ?? "");

  const result = await requestBetCorrection({ betId, justification });

  if (!result.success) {
    redirect(`/play/bets?betError=${encodeURIComponent(result.error)}&betId=${betId}`);
  }

  redirect("/play/bets");
}
