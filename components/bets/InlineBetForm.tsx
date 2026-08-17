"use client";

import { useEffect, useState, useTransition } from "react";
import { saveDraftBet, submitBet, withdrawBet } from "@/lib/actions/bets";
import {
  BET_CATEGORY_OPTIONS,
  BET_DIFFICULTY_LABELS,
  DEFAULT_BET_CATEGORY,
  DEFAULT_BET_DIFFICULTY,
} from "@/lib/labels/bets";
import type { BetCategory, BetDifficulty } from "@/lib/labels/bets";
import { ModalDialog } from "@/components/ui/ModalDialog";
import styles from "./InlineBetForm.module.css";

// Saisie de pari partagée, générique sur le scope (MATCH ou SERIES) —
// GÉNÉRALISÉ le 28/07/2026 depuis components/matches/InlineBetForm.tsx
// (posé le 27/07/2026 pour les paris MATCH dans l'écran Matchs) pour être
// réutilisé aussi par le Bracket personnel (paris SÉRIE, demandé par
// l'utilisateur — « tout centraliser dans Matchs et Bracket »). Volontairement
// DÉCOUPLÉ des contrats de types figés de chaque écran appelant
// (MatchCard.betSlot, BracketFillSeries...) : le parent traduit son propre
// indicateur de slot en `hasBet`/`triggerLabel` avant d'appeler ce composant,
// plutôt que d'imposer une forme unique aux deux écrans.

export type InlineBetFields = { description: string; category: BetCategory; difficulty: BetDifficulty };
export type InlineBetOwned = InlineBetFields & { betId: string; status: "DRAFT" | "SUBMITTED" };

type InlineBetFormProps = {
  scope: "MATCH" | "SERIES";
  matchId: string | null; // null si scope === "SERIES"
  seriesId: string;
  /** Un pari (tout statut confondu) occupe déjà le slot pour cette cible. */
  hasBet: boolean;
  /** Libellé du bouton d'ouverture — construit par l'appelant (ex. "Proposer
   *  un pari" ou "Proposer un pari · 2/3"), ce composant ne connaît pas la
   *  mécanique de quota de chaque écran. */
  triggerLabel: string;
  /** Non NULL seulement si un pari existe ET reste éditable ICI (DRAFT/SUBMITTED). */
  myBet: InlineBetOwned | null;
  /** Masque le bouton de soumission propre — le parent gère alors la
   *  soumission (validation synchronisée, écran Matchs uniquement à ce jour). */
  hideSubmit?: boolean;
  /** Miroir live des champs, NULL tant que rien n'est prêt à soumettre. */
  onFieldsChange?: (fields: InlineBetFields | null) => void;
  /** "modal" (17/08/2026, demandé par l'utilisateur — « ne pas surcharger le
   *  bracket ») : le formulaire ouvert s'affiche en fenêtre centrée
   *  (ModalDialog, même coquille que BetFormModal.tsx) au lieu de se déplier
   *  dans la carte. Défaut "inline" : comportement historique (Matchs),
   *  inchangé. Le bouton déclencheur reste identique dans les 2 cas — seul
   *  le rendu une fois ouvert diffère. */
  presentation?: "inline" | "modal";
};

export function InlineBetForm({
  scope,
  matchId,
  seriesId,
  hasBet,
  triggerLabel,
  myBet,
  hideSubmit,
  onFieldsChange,
  presentation = "inline",
}: InlineBetFormProps) {
  // En mode "modal" (17/08/2026), jamais ouvert par défaut même s'il existe
  // déjà un pari : contrairement à l'inline (où afficher direct le
  // formulaire pré-rempli est voulu), une pop-up ne doit s'ouvrir que sur
  // action explicite — sinon elle apparaîtrait toute seule au chargement de
  // la carte dès qu'un pari existe déjà.
  const [isOpen, setIsOpen] = useState(presentation === "modal" ? false : myBet !== null);
  const [description, setDescription] = useState(myBet?.description ?? "");
  const [category, setCategory] = useState<BetCategory>(myBet?.category ?? DEFAULT_BET_CATEGORY);
  const [difficulty, setDifficulty] = useState<BetDifficulty>(myBet?.difficulty ?? DEFAULT_BET_DIFFICULTY);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!onFieldsChange) return;
    const ready = isOpen && description.trim().length > 0;
    onFieldsChange(ready ? { description, category, difficulty } : null);
  }, [isOpen, description, category, difficulty, onFieldsChange]);

  // Pari déjà posé mais dans un statut non éditable ici (VALIDATED/WON/LOST) :
  // lecture seule, pas de ré-ouverture inline.
  if (hasBet && !myBet) {
    return (
      <span className={styles.disabled} aria-disabled="true">
        Pari déjà posé sur cette {scope === "SERIES" ? "série" : "match"}
      </span>
    );
  }

  if (!isOpen) {
    return (
      <button type="button" className={styles.trigger} onClick={() => setIsOpen(true)}>
        {myBet ? "Modifier le pari" : triggerLabel}
      </button>
    );
  }

  const isSubmittedBet = myBet?.status === "SUBMITTED";
  const descriptionEmpty = description.trim().length === 0;

  function targetPayload() {
    return {
      betId: myBet?.betId,
      scope,
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

  const fields = (
    <>
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
        {!hideSubmit && (
          <button
            type="button"
            className={styles.primary}
            onClick={handleSubmit}
            disabled={isPending || descriptionEmpty}
          >
            {isSubmittedBet ? "Soumettre les modifications" : "Soumettre à validation"}
          </button>
        )}
        {isSubmittedBet && (
          <button type="button" className={styles.withdraw} onClick={handleWithdraw} disabled={isPending}>
            Revenir en brouillon
          </button>
        )}
      </div>
    </>
  );

  if (presentation === "modal") {
    return (
      <ModalDialog title={myBet ? "Modifier le pari" : "Proposer un pari"} onClose={() => setIsOpen(false)}>
        <div className={styles.formModal}>{fields}</div>
      </ModalDialog>
    );
  }

  return <div className={styles.form}>{fields}</div>;
}
