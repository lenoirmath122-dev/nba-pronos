"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { boundedText } from "@/lib/actions/validation";

// SEULE écriture de l'écran "Mes pronos" (SPEC_ECRAN_MES_PRONOS_V0_1 §14).
// Appelle la fonction SQL SECURITY DEFINER de la migration #7 via .rpc() —
// AUCUNE écriture directe sur match_predictions ni correction_requests : tous
// les garde-fous du §10.3 (auth.uid(), joueur ACTIVE, match verrouillé,
// idempotence, justification obligatoire, une seule requête PENDING) vivent
// dans la fonction, côté base, jamais ici. Session utilisateur uniquement
// (getServerClient, jamais service_role).

export type ActionResult = { success: true } | { success: false; error: string };

const MAX_JUSTIFICATION_LENGTH = 2000;
const JustificationSchema = boundedText(MAX_JUSTIFICATION_LENGTH);

export async function requestPredictionCorrection(input: {
  matchId: string;
  justification: string;
  proposedWinnerTeamId?: string;
  proposedMargin?: number;
}): Promise<ActionResult> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  if (!JustificationSchema.safeParse(input.justification).success) {
    return { success: false, error: `${MAX_JUSTIFICATION_LENGTH} caractères maximum.` };
  }

  const { error } = await supabase.rpc("request_prediction_correction", {
    p_match: input.matchId,
    p_justification: input.justification,
    p_proposed_winner_team_id: input.proposedWinnerTeamId ?? null,
    p_proposed_margin: input.proposedMargin ?? null,
  });

  if (error) {
    // Les messages levés par la fonction (§10.3) sont déjà rédigés pour le
    // joueur — on les remonte tels quels plutôt que d'inventer un message
    // générique qui masquerait la vraie raison du refus.
    return { success: false, error: error.message };
  }

  // Une correction peut viser un match des DEUX onglets (Mes pronos/
  // recentLocked OU Résultats, SPEC_REFONTE_ONGLET_JOUER_V0_1 §2.1) — les
  // deux chemins sont invalidés, pas un seul comme avant la fusion.
  revalidatePath("/play");
  revalidatePath("/play/results");
  revalidatePath("/home"); // une requête en attente peut alimenter l'Accueil
  return { success: true };
}

/**
 * Variante `<form action={...}>` NATIVE (§1.1 point 3, aucun JS) : reçoit un
 * FormData brut, appelle requestPredictionCorrection(), puis REDIRIGE — un
 * formulaire sans JS ne peut pas lire une valeur de retour, l'erreur est donc
 * portée par l'URL de la redirection et rendue par la page au rechargement
 * ("erreur rendue au rechargement", §1.1 point 3), jamais par un état client.
 */
export async function requestPredictionCorrectionFormAction(formData: FormData): Promise<void> {
  const matchId = String(formData.get("matchId") ?? "");
  const justification = String(formData.get("justification") ?? "");
  const proposedWinnerTeamIdRaw = formData.get("proposedWinnerTeamId");
  const proposedMarginRaw = formData.get("proposedMargin");
  const returnTo = String(formData.get("returnTo") ?? "/play");

  const result = await requestPredictionCorrection({
    matchId,
    justification,
    proposedWinnerTeamId: proposedWinnerTeamIdRaw ? String(proposedWinnerTeamIdRaw) : undefined,
    proposedMargin: proposedMarginRaw ? Number(proposedMarginRaw) : undefined,
  });

  if (!result.success) {
    const separator = returnTo.includes("?") ? "&" : "?";
    redirect(
      `${returnTo}${separator}correctionError=${encodeURIComponent(result.error)}&correctionMatchId=${matchId}`
    );
  }

  redirect(returnTo);
}
