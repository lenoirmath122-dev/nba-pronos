"use client";

import { useState, useTransition } from "react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { saveBracketPick } from "@/lib/actions/bracket-fill";
import type { BetSeriesFormat, BracketFillSeries } from "@/lib/queries/bracket-fill";
import { InlineBetForm } from "@/components/bets/InlineBetForm";
import styles from "./FillSeriesCard.module.css";

// Carte de remplissage adaptée à une colonne de poster (16/08/2026,
// chantier « remplissage en poster interactif ») — extraite de
// BracketFillBoard.tsx::SeriesPickCard, MÊME logique de saisie (tap
// vainqueur, boutons de score, pari série intégré), mais mise en page
// resserrée pour tenir dans une colonne de poster (13rem,
// SeriesDrillDown.module.css::treeColumn) : équipes empilées verticalement
// au lieu d'une grille 2 colonnes (SeriesPickCard), trop large ici.
//
// `isTarget` (nouveau) : mise en avant visuelle de LA carte ciblée par le
// guidage automatique (FillPosterView.tsx) — même registre que .cardOpen/
// .cardHasPick de NodeCard.module.css (accent additif, jamais une couleur
// de résultat). Pas de callback "pick réussi" à remonter : `saveBracketPick`
// appelle déjà `revalidatePath("/play/bracket")`, qui rafraîchit
// naturellement `data` chez le parent (donc la cible du guidage) sans
// pont client manuel.

const SCORE_FORMATS: BetSeriesFormat[] = ["4-0", "4-1", "4-2", "4-3"];

// ROUND_1 : realTeamA/realTeamB toujours connues dès que la série existe
// (tour racine, colonnes officielles). Tour 2+ : le pari série n'est proposé
// qu'une fois les 2 VRAIES équipes connues, sauf pari déjà posé avant ce
// correctif (04/08/2026) — celui-là reste affiché tel quel plutôt que masqué.
function canOfferSeriesBet(series: BracketFillSeries): boolean {
  return series.round === "ROUND_1" || (series.realTeamA !== null && series.realTeamB !== null) || series.hasBet;
}

type FillSeriesCardProps = {
  series: BracketFillSeries;
  competitionType: "PLAYOFFS" | "NBA_CUP";
  isTarget: boolean;
  onError: (message: string | null) => void;
};

export function FillSeriesCard({ series, competitionType, isTarget, onError }: FillSeriesCardProps) {
  const [winnerTeamId, setWinnerTeamId] = useState(series.myPick.winnerTeamId);
  const [scoreFormat, setScoreFormat] = useState(series.myPick.scoreFormat);
  const [isPending, startTransition] = useTransition();

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
    startTransition(async () => {
      const result = await saveBracketPick({
        seriesId: series.seriesId,
        winnerTeamId: nextWinnerTeamId,
        scoreFormat: nextScoreFormat,
      });
      if (!result.success) onError(result.error);
    });
  }

  const cardClassName = [styles.card, "glass-card", isTarget && styles.cardTarget].filter(Boolean).join(" ");

  return (
    <div id={`series-${series.seriesId}`} className={cardClassName}>
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
              <TeamLogo abbreviation={team.abbreviation} alt={team.name} size={28} />
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

      {/* Pari SÉRIE centralisé ici (demandé par l'utilisateur 28/07/2026 —
          « tout centraliser dans Matchs et Bracket »), même règle que
          SeriesPickCard : porte sur la VRAIE série, jamais sur le
          pronostic du joueur ci-dessus. */}
      {competitionType === "PLAYOFFS" &&
        (canOfferSeriesBet(series) ? (
          <div className={styles.seriesBet}>
            {series.round !== "ROUND_1" && series.realTeamA && series.realTeamB && (
              <p className={styles.seriesBetLabel}>
                Pari : {series.realTeamA.abbreviation} vs {series.realTeamB.abbreviation}
              </p>
            )}
            <InlineBetForm
              scope="SERIES"
              matchId={null}
              seriesId={series.seriesId}
              hasBet={series.hasBet}
              triggerLabel="Proposer un pari"
              myBet={series.myBet}
            />
          </div>
        ) : (
          <p className={styles.pending}>Pari série : équipes réelles pas encore connues.</p>
        ))}
    </div>
  );
}
