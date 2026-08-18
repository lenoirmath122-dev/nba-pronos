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

  // Le cas "pari oublié" peut se produire sur un match encore dans Mes
  // pronos (recentLocked, < 3j) OU déjà dans Résultats — les deux chemins
  // sont invalidés, comme requestPredictionCorrection (corrections.ts).
  revalidatePath("/play");
  revalidatePath("/play/results");
  return { success: true };
}

/**
 * Variante `<form action={...}>` NATIVE (aucun JS) : reçoit un FormData brut,
 * appelle requestBetCorrection(), puis REDIRIGE vers `returnTo` — l'onglet
 * d'origine (porté par le formulaire, même patron que
 * requestPredictionCorrectionFormAction, lib/actions/corrections.ts) plutôt
 * qu'une route fixe : sans ça, une correction déposée depuis Résultats
 * renverrait à tort vers Mes pronos.
 */
export async function requestBetCorrectionFormAction(formData: FormData): Promise<void> {
  const betId = String(formData.get("betId") ?? "");
  const justification = String(formData.get("justification") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/play");

  const result = await requestBetCorrection({ betId, justification });

  if (!result.success) {
    const separator = returnTo.includes("?") ? "&" : "?";
    redirect(`${returnTo}${separator}betError=${encodeURIComponent(result.error)}&betId=${betId}`);
  }

  redirect(returnTo);
}
