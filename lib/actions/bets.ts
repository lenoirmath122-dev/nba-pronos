"use server";

import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";
import type { BetCategory, BetDifficulty } from "@/lib/labels/bets";

// Server actions de l'écran Nouveau pari (SPEC_ECRAN_NOUVEAU_PARI_V0_1 §11).
// AUCUNE écriture directe sur `bets` : tous les garde-fous (propriétaire,
// statut, deadline, cible identifiée, quota COUNT non exprimable en index,
// scope/Cup) vivent dans les fonctions SQL SECURITY DEFINER `save_bet` /
// `withdraw_bet` (migration #9), appelées via .rpc() — même patron que
// lib/actions/corrections.ts. Session utilisateur uniquement
// (getServerClient, jamais service_role).

export type ActionResult = { success: true; betId: string } | { success: false; error: string };
export type SimpleActionResult = { success: true } | { success: false; error: string };

type SaveBetInput = {
  betId?: string; // absent = nouveau pari
  scope: "SERIES" | "MATCH";
  seriesId: string;
  matchId: string | null;
  description: string;
  category: BetCategory;
  difficulty: BetDifficulty;
};

async function callSaveBet(input: SaveBetInput, submit: boolean): Promise<ActionResult> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu dois être connecté." };

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

  revalidatePath("/play/bets");
  revalidatePath("/play/matches");
  revalidatePath("/home");
  return { success: true, betId: data as string };
}

/** « Enregistrer le brouillon » (§8) : persistance sans revue, énoncé optionnel. */
export async function saveDraftBet(input: SaveBetInput): Promise<ActionResult> {
  return callSaveBet(input, false);
}

/** « Soumettre à validation » (§8) : entre dans la file admin, énoncé requis. */
export async function submitBet(input: SaveBetInput): Promise<ActionResult> {
  return callSaveBet(input, true);
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

  revalidatePath("/play/bets");
  revalidatePath("/play/matches");
  revalidatePath("/home");
  return { success: true };
}
