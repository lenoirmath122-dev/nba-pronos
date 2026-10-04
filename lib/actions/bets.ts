"use server";

import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";
import type { BetCategory, BetDifficulty } from "@/lib/labels/bets";
import { structureAndScoreBet } from "@/lib/ai/structureAndScoreBet";
import { boundedText } from "@/lib/actions/validation";
import { checkRateLimit } from "@/lib/actions/rateLimit";

// Server actions de l'écran Nouveau pari (SPEC_ECRAN_NOUVEAU_PARI_V0_1 §11) et
// de Mes paris (suppression, §18/08/2026). AUCUNE écriture directe sur
// `bets` : tous les garde-fous (propriétaire, statut, deadline, cible
// identifiée, quota COUNT non exprimable en index, scope/Cup) vivent dans les
// fonctions SQL SECURITY DEFINER `save_bet` / `withdraw_bet` (migration #9) /
// `delete_bet` (migration 20260818090000), appelées via .rpc() — même patron
// que lib/actions/corrections.ts. Session utilisateur uniquement
// (getServerClient, jamais service_role).

export type ActionResult = { success: true; betId: string } | { success: false; error: string };
export type SubmitBetResult =
  | { success: true; betId: string; autoValidated: boolean }
  // p3-14 : l'IA juge que le joueur visé ne joue pas ce match -- le pari est
  // repassé en brouillon, le client demande confirmation avant de renvoyer
  // avec `confirmPlayerNotInMatch`.
  | { success: true; betId: string; playerNotInMatch: string }
  | { success: false; error: string };
export type SimpleActionResult = { success: true } | { success: false; error: string };

const MAX_DESCRIPTION_LENGTH = 2000;
const DescriptionSchema = boundedText(MAX_DESCRIPTION_LENGTH);

type SaveBetInput = {
  betId?: string; // absent = nouveau pari
  scope: "SERIES" | "MATCH";
  seriesId: string;
  matchId: string | null;
  description: string;
  category: BetCategory;
  difficulty: BetDifficulty;
};

type SubmitBetInput = SaveBetInput & {
  /** Le joueur a vu l'avertissement « joueur absent du match » et envoie quand même (p3-14). */
  confirmPlayerNotInMatch?: boolean;
};

async function callSaveBet(input: SaveBetInput, submit: boolean): Promise<ActionResult> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  // SEC-001 de l'audit du 03/09/2026 : 20 tentatives / minute -- le quota
  // métier réel (3 paris MATCH/série, save_bet) protège déjà le fond ;
  // cette limite ne freine qu'un flot anormal de tentatives (brouillon
  // modifié en boucle, script), pas une saisie/relecture normale.
  if (!(await checkRateLimit(supabase, "bet_submit", 20, 60))) {
    return { success: false, error: "Trop de tentatives, souffle un peu et réessaie dans une minute." };
  }

  if (!DescriptionSchema.safeParse(input.description).success) {
    return { success: false, error: `${MAX_DESCRIPTION_LENGTH} caractères maximum.` };
  }

  const { data, error } = await supabase.rpc("save_bet", {
    p_bet_id: input.betId ?? null,
    p_scope: input.scope,
    p_series_id: input.seriesId,
    p_match_id: input.matchId,
    p_description: input.description,
    p_category: input.category,
    p_difficulty: input.difficulty,
    p_submit: submit,
  });

  if (error) {
    // Les messages levés par la fonction (§12) sont déjà rédigés pour le
    // joueur — on les remonte tels quels plutôt que d'inventer un message
    // générique qui masquerait la vraie raison du refus.
    return { success: false, error: error.message };
  }

  revalidatePath("/play");
  revalidatePath("/play/results");
  revalidatePath("/home");
  return { success: true, betId: data as string };
}

/** « Enregistrer le brouillon » (§8) : persistance sans revue, énoncé optionnel. */
export async function saveDraftBet(input: SaveBetInput): Promise<ActionResult> {
  return callSaveBet(input, false);
}

/** « Soumettre à validation » (§8) : entre dans la file admin, énoncé requis
 *  -- SAUF si l'IA arrive à calculer une proba (Phase 5 Data NBA,
 *  21/08/2026, décidé avec l'utilisateur) : dans ce cas le pari est
 *  auto-validé (saute la file admin), voir update_bet_structuration.
 *  Synchrone, best-effort : une panne de cette étape ne fait jamais
 *  échouer la soumission elle-même (voir structureAndScoreBet.ts).
 *  revalidatePath rappelé APRÈS (pas seulement dans callSaveBet) --
 *  l'auto-validation change le statut du pari après le 1er appel. */
export async function submitBet(input: SubmitBetInput): Promise<SubmitBetResult> {
  const { confirmPlayerNotInMatch, ...saveInput } = input;
  const result = await callSaveBet(saveInput, true);
  if (!result.success) return result;

  const outcome = await structureAndScoreBet(result.betId, input.description, input.seriesId, input.scope, input.matchId, {
    confirmPlayerNotInMatch,
  });
  const supabase = await getServerClient();

  // p3-14 (04/10/2026) : joueur absent des 2 équipes selon l'IA et pas
  // encore confirmé -- retour en brouillon (SUBMITTED → DRAFT, withdraw_bet)
  // plutôt qu'une auto-validation à 0 % que le joueur ne pourrait plus
  // supprimer. Si ce retour échoue, le pari reste soumis non structuré et
  // part dans la file admin, comme toute autre panne de structuration.
  if (outcome.playerNotInMatch) {
    const { error } = await supabase.rpc("withdraw_bet", { p_bet_id: result.betId });
    revalidatePath("/play");
    revalidatePath("/play/results");
    revalidatePath("/home");
    if (!error) return { success: true, betId: result.betId, playerNotInMatch: outcome.playerNotInMatch };
    return { success: true, betId: result.betId, autoValidated: false };
  }

  revalidatePath("/play");
  revalidatePath("/play/results");
  revalidatePath("/home");

  // Statut relu APRÈS la structuration (04/10/2026) : le client affiche la
  // popup « Pari validé » si l'IA a fait sauter la file admin, sinon le
  // simple toast « envoyé à validation ». Une lecture ratée retombe sur ce
  // second cas, jamais sur un échec de la soumission elle-même.
  const { data: bet } = await supabase.from("bets").select("status").eq("id", result.betId).maybeSingle();
  return { success: true, betId: result.betId, autoValidated: bet?.status === "VALIDATED" };
}

/** « Revenir en brouillon » (§9, geste « retirer ») : SUBMITTED → DRAFT, aucun champ touché. */
export async function withdrawBet(betId: string): Promise<SimpleActionResult> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const { error } = await supabase.rpc("withdraw_bet", { p_bet_id: betId });
  if (error) return { success: false, error: error.message };

  revalidatePath("/play");
  revalidatePath("/play/results");
  revalidatePath("/home");
  return { success: true };
}

/** « Supprimer » un pari encore modifiable (DRAFT/SUBMITTED, 18/08/2026) —
 *  sous le capot, passage à CANCELLED (rétention D2, migration
 *  20260818090000_delete_bet_function.sql) : la ligne reste en base, sort de
 *  « En cours » et libère son slot de quota. */
export async function deleteBet(betId: string): Promise<SimpleActionResult> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

  const { error } = await supabase.rpc("delete_bet", { p_bet_id: betId });
  if (error) return { success: false, error: error.message };

  revalidatePath("/play");
  revalidatePath("/play/results");
  revalidatePath("/home");
  return { success: true };
}
