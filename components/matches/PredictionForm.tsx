"use client";

import { useEffect, useState, useTransition } from "react";
import { useUnsavedGuard } from "@/lib/hooks/useUnsavedGuard";
import { saveMatchPredictionDraft, validateMatchPrediction } from "@/lib/actions/matches";
import type { MatchCard } from "@/lib/queries/matches";
import { TeamPicker } from "./TeamPicker";
import { MarginStepper } from "./MarginStepper";
import { RevealPanel } from "./RevealPanel";
import { InlineBetForm } from "./InlineBetForm";
import styles from "./PredictionForm.module.css";

// Ligne dépliée — feuille client n°2/3 (§1) : porte l'état de saisie local
// (winner/margin) et le drapeau `dirty` consommé par useUnsavedGuard (C2).
// Ordre imposé par §3.2 : affrontement → écart → panneau « valider = voir »
// → actions → raccourci pari.
//
// Une fois VALIDATED (donnée serveur, via `match.viewStatus`), plus aucune
// saisie n'est rendue : irréversible, la ligne bascule en lecture seule +
// révélation. Ce n'est jamais un état local — toujours dérivé de la prop.

function winnerAbbreviation(match: MatchCard): string | null {
  if (match.myWinnerTeamId === match.homeTeam.id) return match.homeTeam.abbreviation;
  if (match.myWinnerTeamId === match.awayTeam.id) return match.awayTeam.abbreviation;
  return null;
}

type PredictionFormProps = { match: MatchCard };

export function PredictionForm({ match }: PredictionFormProps) {
  const { markDirty, clearDirty } = useUnsavedGuard(match.matchId);
  const [winner, setWinner] = useState<string | null>(match.myWinnerTeamId);
  const [margin, setMargin] = useState<number | null>(match.myMargin);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showValidateConfirm, setShowValidateConfirm] = useState(false);

  useEffect(() => {
    const dirty = winner !== match.myWinnerTeamId || margin !== match.myMargin;
    if (dirty) markDirty();
    else clearDirty();
  }, [winner, margin, match.myWinnerTeamId, match.myMargin, markDirty, clearDirty]);

  // Ligne repliée (démontage) : la saisie locale non enregistrée disparaît
  // avec elle — rien ne reste à protéger pour cette clé.
  useEffect(() => () => clearDirty(), [clearDirty]);

  if (match.viewStatus === "VALIDATED") {
    return (
      <div className={styles.form}>
        <p className={styles.validatedRecap}>
          Ton prono : {winnerAbbreviation(match)} −{match.myMargin}
        </p>
        <RevealPanel
          isRevealed={match.isRevealed}
          predictedCount={match.predictedCount}
          eligibleCount={match.eligibleCount}
          others={match.others}
          absentees={match.absentees}
        />
      </div>
    );
  }

  const isComplete = winner !== null && margin !== null;

  function handleSaveDraft() {
    setError(null);
    startTransition(async () => {
      const result = await saveMatchPredictionDraft({
        matchId: match.matchId,
        predictedWinnerTeamId: winner,
        predictedMargin: margin,
      });
      if (result.success) clearDirty();
      else setError(result.error);
    });
  }

  function handleValidate() {
    setError(null);
    startTransition(async () => {
      const result = await validateMatchPrediction(match.matchId);
      setShowValidateConfirm(false);
      if (result.success) clearDirty();
      else setError(result.error);
    });
  }

  return (
    <div className={styles.form}>
      <TeamPicker homeTeam={match.homeTeam} awayTeam={match.awayTeam} selectedTeamId={winner} onSelect={setWinner} />

      <MarginStepper value={margin} onChange={setMargin} />

      <RevealPanel
        isRevealed={match.isRevealed}
        predictedCount={match.predictedCount}
        eligibleCount={match.eligibleCount}
        others={match.others}
        absentees={match.absentees}
      />

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={handleSaveDraft} disabled={isPending}>
          Enregistrer le brouillon
        </button>
        <button
          type="button"
          className={styles.primary}
          onClick={() => setShowValidateConfirm(true)}
          disabled={isPending || !isComplete}
        >
          Valider le prono
        </button>
      </div>

      <InlineBetForm
        matchId={match.matchId}
        seriesId={match.seriesId}
        betSlot={match.betSlot}
        myBet={match.myBet}
      />

      {/* Dialogue de VALIDATION — distinct du dialogue C2 de perte de saisie
          (§7) : wording et déclencheur différents, ne pas fusionner. */}
      {showValidateConfirm && (
        <div className={styles.backdrop} role="presentation">
          <div
            className={styles.dialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`validate-title-${match.matchId}`}
          >
            <p id={`validate-title-${match.matchId}`} className={styles.dialogTitle}>
              Valider ce prono ?
            </p>
            <p className={styles.dialogBody}>
              Une fois validé, il n&rsquo;est plus modifiable — et tu verras (comme les autres joueurs) les pronos
              déjà déposés sur ce match.
            </p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.dialogCancel}
                onClick={() => setShowValidateConfirm(false)}
                disabled={isPending}
              >
                Annuler
              </button>
              <button type="button" className={styles.dialogConfirm} onClick={handleValidate} disabled={isPending}>
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
