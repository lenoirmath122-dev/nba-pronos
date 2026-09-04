"use client";

import { useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { saveBracketPick, validateBracket } from "@/lib/actions/bracket-fill";
import type { BetSeriesFormat, BracketFillSeries } from "@/lib/queries/bracket-fill";
import { InlineBetForm } from "@/components/bets/InlineBetForm";
import { ResetBracketButton } from "./ResetBracketButton";
import { FocusTrap } from "@/components/ui/FocusTrap";
import styles from "./BracketFillBoard.module.css";

// SEULE feuille "use client" de l'écran Bracket personnel (§1 de la spec) :
// porte la saisie (tap vainqueur + boutons de score) et le bouton de
// validation. Chaque tap enregistre IMMÉDIATEMENT (pas de brouillon
// local à confirmer séparément — 0.2.9 §5 : "vainqueur en 1 tap").

const SCORE_FORMATS: BetSeriesFormat[] = ["4-0", "4-1", "4-2", "4-3"];

// ROUND_1 : realTeamA/realTeamB toujours connues dès que la série existe
// (tour racine, colonnes officielles). Tour 2+ : le pari série n'est proposé
// qu'une fois les 2 VRAIES équipes connues, sauf pari déjà posé avant ce
// correctif (04/08/2026) — celui-là reste affiché tel quel plutôt que masqué.
function canOfferSeriesBet(series: BracketFillSeries): boolean {
  return series.round === "ROUND_1" || (series.realTeamA !== null && series.realTeamB !== null) || series.hasBet;
}

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
        <ResetBracketButton onError={setError} />
      </div>

      {showConfirm &&
        // Portail vers document.body (05/08/2026) : l'écran Bracket personnel
        // isole son fond photo dans son propre contexte d'empilement
        // (.photo-page, globals.css) — sans ce portail, ce backdrop y serait
        // piégé et ne couvrirait plus toute la page (TabBar comprise).
        createPortal(
          <div className={styles.backdrop} role="presentation">
            <FocusTrap
              className={styles.dialog}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="validate-bracket-title"
              onClose={() => setShowConfirm(false)}
            >
              <p id="validate-bracket-title" className={styles.dialogTitle}>
                Valider ton bracket ?
              </p>
              <p className={styles.dialogBody}>
                Ton bracket reste modifiable jusqu&rsquo;à la deadline, même après validation — tu peux revenir
                corriger un pick à tout moment avant ça.
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
            </FocusTrap>
          </div>,
          document.body
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
  // Resynchronise l'état local sur la valeur serveur pendant le rendu, même
  // correctif que FillSeriesCard.tsx (17/08/2026) : sans ça, une remise à
  // zéro du bracket ne se reflétait pas ici tant que l'écran n'était pas
  // rechargé.
  const pickSignature = `${series.myPick.winnerTeamId ?? ""}|${series.myPick.scoreFormat ?? ""}`;
  const [syncedSignature, setSyncedSignature] = useState(pickSignature);
  const [winnerTeamId, setWinnerTeamId] = useState(series.myPick.winnerTeamId);
  const [scoreFormat, setScoreFormat] = useState(series.myPick.scoreFormat);
  if (pickSignature !== syncedSignature) {
    setSyncedSignature(pickSignature);
    setWinnerTeamId(series.myPick.winnerTeamId);
    setScoreFormat(series.myPick.scoreFormat);
  }
  // File d'attente des sauvegardes, même correctif que FillSeriesCard.tsx
  // (17/08/2026, latence signalée entre le tap vainqueur et le tap score) :
  // boutons non désactivés pendant l'aller-retour, mais les appels à
  // saveBracketPick restent en série pour ne jamais laisser une réponse en
  // retard écraser un pick plus récent.
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  if (!series.isSelectable) {
    return (
      <div id={`series-${series.seriesId}`} className={`${styles.card} glass-card`}>
        <p className={styles.pending}>Équipe à définir — complète les séries précédentes.</p>
      </div>
    );
  }

  function pick(nextWinnerTeamId: string, nextScoreFormat: BetSeriesFormat | null) {
    setWinnerTeamId(nextWinnerTeamId);
    setScoreFormat(nextScoreFormat);
    onError(null);
    saveChainRef.current = saveChainRef.current.catch(() => {}).then(async () => {
      const result = await saveBracketPick({
        seriesId: series.seriesId,
        winnerTeamId: nextWinnerTeamId,
        scoreFormat: nextScoreFormat,
      });
      if (!result.success) onError(result.error);
    });
  }

  return (
    <div id={`series-${series.seriesId}`} className={`${styles.card} glass-card`}>
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
            >
              <TeamLogo abbreviation={team.abbreviation} alt={team.name} size={32} />
              <span className={styles.teamName}>{team.name}</span>
            </button>
          );
        })}
      </div>

      {competitionType === "PLAYOFFS" && winnerTeamId && (
        <div className={styles.scores}>
          {SCORE_FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              className={scoreFormat === format ? `${styles.scoreButton} ${styles.scoreButtonSelected}` : styles.scoreButton}
              onClick={() => pick(winnerTeamId, format)}
              aria-pressed={scoreFormat === format}
            >
              {format}
            </button>
          ))}
        </div>
      )}

      {/* Pari SÉRIE centralisé ici (demandé par l'utilisateur 28/07/2026 —
          « tout centraliser dans Matchs et Bracket ») — jamais dans Matchs,
          qui reste réservé aux paris MATCH. NBA Cup exclu : une "série" y est
          1 seul match (T1), le pari SÉRIE y est de toute façon refusé par
          save_bet (migration #10) — pas la peine d'offrir une action vouée à
          l'échec.

          Porte sur la VRAIE série (series.realTeamA/realTeamB), jamais sur le
          pronostic du joueur (series.teamA/teamB, cascade de picks ci-dessus)
          — pour un tour 2+ pas encore joué en réalité, ces 2 informations
          peuvent diverger. Tant que les 2 vraies équipes ne sont pas
          connues : pas de nouveau pari proposé (placeholder), sauf pour un
          pari déjà posé avant ce correctif (04/08/2026) — celui-ci reste
          affiché tel quel. */}
      {competitionType === "PLAYOFFS" &&
        (canOfferSeriesBet(series) ? (
          <div className={styles.seriesBet}>
            {series.round !== "ROUND_1" && series.realTeamA && series.realTeamB && (
              <p className={styles.seriesBetLabel}>
                Pari sur la vraie série : {series.realTeamA.abbreviation} vs {series.realTeamB.abbreviation}
              </p>
            )}
            <InlineBetForm
              scope="SERIES"
              matchId={null}
              seriesId={series.seriesId}
              hasBet={series.hasBet}
              triggerLabel="Proposer un pari"
              myBet={series.myBet}
              presentation="modal"
            />
          </div>
        ) : (
          <p className={styles.pending}>Pari série : les 2 équipes réelles ne sont pas encore connues.</p>
        ))}
    </div>
  );
}
