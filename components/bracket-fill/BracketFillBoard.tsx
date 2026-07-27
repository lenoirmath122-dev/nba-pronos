"use client";

import { useState, useTransition } from "react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { saveBracketPick, validateBracket } from "@/lib/actions/bracket-fill";
import type { BetSeriesFormat, BracketFillSeries } from "@/lib/queries/bracket-fill";
import styles from "./BracketFillBoard.module.css";

// SEULE feuille "use client" de l'écran Bracket personnel (§1 de la spec) :
// porte la saisie (tap vainqueur + boutons de score) et le bouton de
// validation. Chaque tap enregistre IMMÉDIATEMENT (pas de brouillon
// local à confirmer séparément — 0.2.9 §5 : "vainqueur en 1 tap").

const SCORE_FORMATS: BetSeriesFormat[] = ["4-0", "4-1", "4-2", "4-3"];

type BracketFillBoardProps = {
  series: BracketFillSeries[];
  competitionType: "PLAYOFFS" | "NBA_CUP";
  isValidated: boolean;
  isAutoValidated: boolean;
};

export function BracketFillBoard({ series, competitionType, isValidated, isAutoValidated }: BracketFillBoardProps) {
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleValidate() {
    setError(null);
    startTransition(async () => {
      const result = await validateBracket();
      setShowConfirm(false);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className={styles.board}>
      {series.map((s) => (
        <SeriesPickCard key={s.seriesId} series={s} competitionType={competitionType} onError={setError} />
      ))}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.validateRow}>
        {isValidated ? (
          <p className={styles.validatedNote}>
            Bracket validé{isAutoValidated ? " automatiquement" : ""} — reste modifiable jusqu&rsquo;à la deadline.
          </p>
        ) : (
          <button type="button" className={styles.validateButton} onClick={() => setShowConfirm(true)}>
            Valider mon bracket
          </button>
        )}
      </div>

      {showConfirm && (
        <div className={styles.backdrop} role="presentation">
          <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby="validate-bracket-title">
            <p id="validate-bracket-title" className={styles.dialogTitle}>
              Valider ton bracket ?
            </p>
            <p className={styles.dialogBody}>
              Ton bracket reste modifiable jusqu&rsquo;à la deadline, même après validation — tu peux revenir corriger
              un pick à tout moment avant ça.
            </p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.dialogCancel}
                onClick={() => setShowConfirm(false)}
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

type SeriesPickCardProps = {
  series: BracketFillSeries;
  competitionType: "PLAYOFFS" | "NBA_CUP";
  onError: (message: string | null) => void;
};

function SeriesPickCard({ series, competitionType, onError }: SeriesPickCardProps) {
  const [winnerTeamId, setWinnerTeamId] = useState(series.myPick.winnerTeamId);
  const [scoreFormat, setScoreFormat] = useState(series.myPick.scoreFormat);
  const [isPending, startTransition] = useTransition();

  if (!series.isSelectable) {
    return (
      <div className={styles.card}>
        <p className={styles.pending}>Équipe à définir — complète les séries précédentes.</p>
      </div>
    );
  }

  function pick(nextWinnerTeamId: string, nextScoreFormat: BetSeriesFormat | null) {
    setWinnerTeamId(nextWinnerTeamId);
    setScoreFormat(nextScoreFormat);
    onError(null);
    startTransition(async () => {
      const result = await saveBracketPick({
        seriesId: series.seriesId,
        winnerTeamId: nextWinnerTeamId,
        scoreFormat: nextScoreFormat,
      });
      if (!result.success) onError(result.error);
    });
  }

  return (
    <div className={styles.card}>
      <div className={styles.teams}>
        {[series.teamA, series.teamB].map((team) => {
          if (!team) return null;
          const isSelected = winnerTeamId === team.teamId;
          return (
            <button
              key={team.teamId}
              type="button"
              className={isSelected ? `${styles.team} ${styles.teamSelected}` : styles.team}
              onClick={() => pick(team.teamId, scoreFormat)}
              aria-pressed={isSelected}
              disabled={isPending}
            >
              <TeamLogo abbreviation={team.abbreviation} alt={team.name} size={32} />
              <span className={styles.teamName}>{team.name}</span>
            </button>
          );
        })}
      </div>

      {competitionType === "PLAYOFFS" && (
        <div className={styles.scores}>
          {SCORE_FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              className={scoreFormat === format ? `${styles.scoreButton} ${styles.scoreButtonSelected}` : styles.scoreButton}
              onClick={() => winnerTeamId && pick(winnerTeamId, format)}
              disabled={isPending || !winnerTeamId}
              aria-pressed={scoreFormat === format}
            >
              {format}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
