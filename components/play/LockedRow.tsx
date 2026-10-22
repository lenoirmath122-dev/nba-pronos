"use client";

import { useState } from "react";
import { PeopleIcon } from "@/components/icons/play-icons";
import type { LockedMatchRow as LockedMatchRowData } from "@/lib/queries/play";
import { clickableRowProps } from "@/lib/hooks/clickableRow";
import { LiveBadgeAndScore } from "./LiveSubscriber";
import { PredictionSummary } from "./PredictionSummary";
import { BetBlock } from "./BetBlock";
import { MatchAffiche } from "./MatchAffiche";
import { MatchBetZone } from "./MatchBetZone";
import { OthersOnMatch } from "./OthersOnMatch";
import { CorrectionRequestForm } from "./CorrectionRequestForm";
import styles from "./LockedRow.module.css";

// Ligne d'un match verrouillé — utilisée par l'onglet Résultats
// (matchs commencés, réglés ou non). Aucune saisie de
// prono NI de pari (§3.3 SPEC_REFONTE_ONGLET_JOUER_V0_1 : les deux deadlines
// coïncident au verrouillage) — cet écran consulte, il ne rouvre rien.
// Ex-components/my-predictions/MatchRowStatic.tsx.
//
// Passée en "use client" (22/08/2026, demandé par l'utilisateur) : la carte
// visible (en-tête + prono) déclenche désormais le repli/dépli du contenu
// additionnel -- DONT le pari (BetBlock, déplacé ici sur demande explicite,
// plus affiché en permanence) -- à la place du texte "Plus d'options".
// Même patron `clickableRowProps` que NodeCard.tsx (bracket).

function formatKickoff(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

type LockedRowProps = {
  row: LockedMatchRowData;
  returnTo: string;
  /** Requête de correction du PRONO (formulaire "Demander une correction",
   *  distinct du pari) — force l'ouverture du déclencheur commun quand on
   *  revient ici après une erreur sur CE match précis. */
  forceOpenPredictionCorrection: boolean;
  predictionCorrectionError?: string;
  /** Requête de correction du PARI ("Signaler à un admin", cas "pari
   *  oublié") — mécanisme et query params DISTINCTS de ceux du prono, un
   *  match peut avoir les deux formulaires en même temps. */
  forceOpenBetCorrection: boolean;
  betCorrectionError?: string;
  maxBetPoints: number;
};

export function LockedRow({
  row,
  returnTo,
  forceOpenPredictionCorrection,
  predictionCorrectionError,
  forceOpenBetCorrection,
  betCorrectionError,
  maxBetPoints,
}: LockedRowProps) {
  const forceOpenMore = forceOpenPredictionCorrection || forceOpenBetCorrection;
  const [isOpen, setIsOpen] = useState(forceOpenMore);
  const [othersOpen, setOthersOpen] = useState(false);

  // Le résumé du pari (énoncé, statut, points) vit dans la zone « Mon pari » ;
  // BetBlock ne reste dans le dépli que pour ce qu'elle n'affiche pas.
  const bet = row.bet;
  const betHasExtras =
    forceOpenBetCorrection ||
    (bet !== null &&
      (bet.isForgottenResolution ||
        bet.refusalReason !== null ||
        bet.resolutionReason !== null ||
        bet.reproposeHref !== null ||
        bet.isAdminCorrected ||
        (bet.isCalculable && bet.calculatedProba !== null && bet.status !== "DRAFT" && bet.status !== "SUBMITTED")));

  return (
    <div id={`match-${row.matchId}`} className={`${styles.row} glass-card`}>
      <div {...clickableRowProps(() => setIsOpen((v) => !v))} className={styles.trigger} aria-expanded={isOpen}>
        <div className={styles.header}>
          <span className={styles.gameNumber}>{row.daily ? row.daily.dayLabel : `Match ${row.gameNumber}`}</span>
          <LiveBadgeAndScore
            matchId={row.matchId}
            fallback={{
              liveState: row.liveState,
              homeScore: row.homeScore,
              awayScore: row.awayScore,
            }}
            scheduledAtLabel={row.daily ? row.daily.shortLabel : formatKickoff(row.scheduledAt)}
          />
          <span className={styles.headerRight}>
            <MatchAffiche home={row.home} away={row.away} />
            <span className={isOpen ? styles.chevronOpen : styles.chevron} aria-hidden="true">
              ▾
            </span>
          </span>
        </div>

        {/* Bande « Mon prono » + icône « personnes » à sa droite (pronos et
            paris des autres). stopPropagation : le bouton est dans la carte
            cliquable, il ne doit pas la replier/déplier. */}
        <div className={styles.pronoRow}>
          <div className={styles.pronoBand}>
            <PredictionSummary prediction={row.prediction} betPoints={row.bet?.pointsAwarded ?? null} />
          </div>
          <button
            type="button"
            className={styles.othersButton}
            aria-label="Pronos et paris des autres"
            onClick={(e) => {
              e.stopPropagation();
              setOthersOpen(true);
            }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <PeopleIcon size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      <MatchBetZone
        matchId={row.matchId}
        seriesId={row.seriesId}
        bet={row.bet}
        closedMessage="Plus de pari possible : le match a commencé."
        locked
        placeholderTeam=""
        maxPoints={maxBetPoints}
        onViewOthers={() => setOthersOpen(true)}
      />

      {/* Repliés sous la carte cliquable ci-dessus (22/08/2026, remplace le
          texte "Plus d'options" -- demandé par l'utilisateur, qui a aussi
          demandé d'y déplacer le pari BetBlock lui-même, plus affiché en
          permanence). Rendu conditionnel plutôt que <details> : ce contenu
          est un FRÈRE du déclencheur, pas un descendant -- un clic à
          l'intérieur (formulaire de correction, bouton Reproposer, etc.) ne
          referme jamais la carte par erreur (pas besoin de stopPropagation
          ici, contrairement à quand BetBlock vivait DANS le déclencheur).
          Forcé ouvert si on revient ici après une erreur de correction
          (prono OU pari) sur CE match précis. */}
      {isOpen && (
        <div className={styles.moreContent}>
          {row.bet && betHasExtras && (
            <BetBlock
              hideSummary
              bet={row.bet}
              returnTo={returnTo}
              forceOpenCorrection={forceOpenBetCorrection}
              correctionError={betCorrectionError}
            />
          )}

          <CorrectionRequestForm
            matchId={row.matchId}
            home={row.home}
            away={row.away}
            correctionRequest={row.correctionRequest}
            returnTo={returnTo}
            forceOpen={forceOpenPredictionCorrection}
            error={predictionCorrectionError}
          />
        </div>
      )}

      <OthersOnMatch
        open={othersOpen}
        onClose={() => setOthersOpen(false)}
        mode="locked"
        others={row.others}
        absenteeCount={row.absenteeCount}
        bets={row.otherBets}
      />
    </div>
  );
}
