"use client";

import { useState, useTransition } from "react";
import { saveDraftBet, submitBet, withdrawBet } from "@/lib/actions/bets";
import {
  BET_CATEGORY_OPTIONS,
  BET_DIFFICULTY_LABELS,
  DEFAULT_BET_CATEGORY,
  DEFAULT_BET_DIFFICULTY,
} from "@/lib/labels/bets";
import type { BetCategory, BetDifficulty } from "@/lib/labels/bets";
import type { BetSlotIndicator, MyMatchBet } from "@/lib/queries/matches";
import styles from "./InlineBetForm.module.css";

// Saisie du pari DIRECTEMENT dans la ligne Match dépliée (demandé 27/07/2026,
// en complément — pas en remplacement — de /play/bets/new et /play/bets/
// [id]/edit qui restent l'entrée pour les paris SÉRIE et le hub libre). Cible
// TOUJOURS ce match précis (scope MATCH figé, pas de sélecteur série/match ici
// — la cible est déjà connue du contexte). Sans "use client" propre : rendu
// par PredictionForm, qui porte déjà la frontière cliente de l'écran Matchs.
//
// Remplace l'ancien BetShortcut (lien vers l'écran dédié) : même logique de
// disponibilité (betSlot), mais le formulaire s'ouvre ICI plutôt que de
// naviguer ailleurs.

type InlineBetFormProps = {
  matchId: string;
  seriesId: string;
  betSlot: BetSlotIndicator;
  myBet: MyMatchBet | null;
};

export function InlineBetForm({ matchId, seriesId, betSlot, myBet }: InlineBetFormProps) {
  const [isOpen, setIsOpen] = useState(myBet !== null);
  const [description, setDescription] = useState(myBet?.description ?? "");
  const [category, setCategory] = useState<BetCategory>(myBet?.category ?? DEFAULT_BET_CATEGORY);
  const [difficulty, setDifficulty] = useState<BetDifficulty>(myBet?.difficulty ?? DEFAULT_BET_DIFFICULTY);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Pari déjà posé mais dans un statut non éditable ici (VALIDATED/WON/LOST,
  // §9) : lecture seule, comme avant — pas de ré-ouverture inline.
  if (betSlot.hasBetOnThisMatch && !myBet) {
    return (
      <span className={styles.disabled} aria-disabled="true">
        Pari déjà posé sur ce match
      </span>
    );
  }

  if (!isOpen) {
    const label =
      betSlot.mode === "BINARY" ? "Proposer un pari" : `Proposer un pari · ${betSlot.usedSlots}/${betSlot.totalSlots}`;
    return (
      <button type="button" className={styles.trigger} onClick={() => setIsOpen(true)}>
        {label}
      </button>
    );
  }

  const isSubmittedBet = myBet?.status === "SUBMITTED";
  const descriptionEmpty = description.trim().length === 0;

  function targetPayload() {
    return {
      betId: myBet?.betId,
      scope: "MATCH" as const,
      seriesId,
      matchId,
      description,
      category,
      difficulty,
    };
  }

  function handleSaveDraft() {
    setError(null);
    startTransition(async () => {
      const result = await saveDraftBet(targetPayload());
      if (!result.success) setError(result.error);
    });
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitBet(targetPayload());
      if (!result.success) setError(result.error);
    });
  }

  function handleWithdraw() {
    if (!myBet) return;
    setError(null);
    startTransition(async () => {
      const result = await withdrawBet(myBet.betId);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className={styles.form}>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Énoncé</span>
        <textarea
          className={styles.textarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex. Un joueur des Knicks marque 30+"
          rows={2}
        />
      </label>

      <div className={styles.selectRow}>
        <select
          className={styles.select}
          value={category}
          onChange={(e) => setCategory(e.target.value as BetCategory)}
        >
          {BET_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={difficulty}
          onChange={(e) => setDifficulty(Number(e.target.value) as BetDifficulty)}
        >
          {([1, 2, 3, 4, 5] as BetDifficulty[]).map((level) => (
            <option key={level} value={level}>
              {level} — {BET_DIFFICULTY_LABELS[level]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        {!isSubmittedBet && (
          <button type="button" className={styles.secondary} onClick={handleSaveDraft} disabled={isPending}>
            Enregistrer le brouillon
          </button>
        )}
        <button
          type="button"
          className={styles.primary}
          onClick={handleSubmit}
          disabled={isPending || descriptionEmpty}
        >
          {isSubmittedBet ? "Soumettre les modifications" : "Soumettre à validation"}
        </button>
        {isSubmittedBet && (
          <button type="button" className={styles.withdraw} onClick={handleWithdraw} disabled={isPending}>
            Revenir en brouillon
          </button>
        )}
      </div>
    </div>
  );
}
