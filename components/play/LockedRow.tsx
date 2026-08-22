"use client";

import { useState } from "react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import type { LockedMatchRow as LockedMatchRowData } from "@/lib/queries/play";
import { clickableRowProps } from "@/lib/hooks/clickableRow";
import { LiveBadgeAndScore } from "./LiveSubscriber";
import { PredictionSummary } from "./PredictionSummary";
import { RevealPanelLocked } from "./RevealPanelLocked";
import { BetBlock } from "./BetBlock";
import { OtherBetsModal } from "./OtherBetsModal";
import { CorrectionRequestForm } from "./CorrectionRequestForm";
import styles from "./LockedRow.module.css";

// Ligne d'un match verrouillé — utilisée à la fois par l'onglet Mes pronos
// (recentLocked, verrouillé < 3j) et l'onglet Résultats. Aucune saisie de
// prono NI de pari (§3.3 SPEC_REFONTE_ONGLET_JOUER_V0_1 : les deux deadlines
// coïncident au verrouillage) — cet écran consulte, il ne rouvre rien.
// Ex-components/my-predictions/MatchRowStatic.tsx.
//
// Passée en "use client" (22/08/2026, demandé par l'utilisateur) : la carte
// entière (en-tête + prono + pari) déclenche désormais le repli/dépli du
// contenu additionnel, à la place du texte "Plus d'options" -- même patron
// `clickableRowProps` que NodeCard.tsx (bracket), pour le même problème
// (BetBlock imbrique ses propres liens/formulaires, un clic dessus ne doit
// PAS aussi basculer la carte -- stopPropagation posé où c'est nécessaire).

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
};

export function LockedRow({
  row,
  returnTo,
  forceOpenPredictionCorrection,
  predictionCorrectionError,
  forceOpenBetCorrection,
  betCorrectionError,
}: LockedRowProps) {
  const forceOpenMore = forceOpenPredictionCorrection || forceOpenBetCorrection;
  const [isOpen, setIsOpen] = useState(forceOpenMore);

  return (
    <div id={`match-${row.matchId}`} className={`${styles.row} glass-card`}>
      <div {...clickableRowProps(() => setIsOpen((v) => !v))} className={styles.trigger} aria-expanded={isOpen}>
        <div className={styles.header}>
          <span className={styles.teams}>
            <TeamLogo abbreviation={row.home.abbreviation} alt={row.home.name} size={24} />
            {row.home.abbreviation} – {row.away.abbreviation}
            <TeamLogo abbreviation={row.away.abbreviation} alt={row.away.name} size={24} />
          </span>
          <span className={styles.gameNumber}>Match {row.gameNumber}</span>
          <span className={styles.headerRight}>
            <LiveBadgeAndScore
              matchId={row.matchId}
              fallback={{ liveState: row.liveState, homeScore: row.homeScore, awayScore: row.awayScore }}
              scheduledAtLabel={formatKickoff(row.scheduledAt)}
            />
            <span className={isOpen ? styles.chevronOpen : styles.chevron} aria-hidden="true">
              ▾
            </span>
          </span>
        </div>

        <PredictionSummary prediction={row.prediction} />

        {row.bet && (
          // stopPropagation (22/08/2026) : BetBlock imbrique ses propres
          // liens/formulaires (Reproposer, Signaler à un admin) -- sans ça,
          // un clic dessus basculerait AUSSI le repli/dépli de toute la
          // carte, en plus de sa propre action.
          <div onClick={(event) => event.stopPropagation()}>
            <BetBlock
              bet={row.bet}
              returnTo={returnTo}
              forceOpenCorrection={forceOpenBetCorrection}
              correctionError={betCorrectionError}
            />
          </div>
        )}
      </div>

      {/* Repliés sous la carte cliquable ci-dessus (22/08/2026, remplace le
          texte "Plus d'options" -- demandé par l'utilisateur) : ces 3 blocs
          prenaient chacun une ligne visible en permanence sur CHAQUE match,
          même repliés. Rendu conditionnel plutôt que <details> : ce contenu
          est un FRÈRE du déclencheur, pas un descendant -- un clic à
          l'intérieur (formulaire de correction, etc.) ne referme jamais la
          carte par erreur. Forcé ouvert si on revient ici après une erreur
          de correction (prono OU pari) sur CE match précis. */}
      {isOpen && (
        <div className={styles.moreContent}>
          <OtherBetsModal bets={row.otherBets} />

          <CorrectionRequestForm
            matchId={row.matchId}
            home={row.home}
            away={row.away}
            correctionRequest={row.correctionRequest}
            returnTo={returnTo}
            forceOpen={forceOpenPredictionCorrection}
            error={predictionCorrectionError}
          />

          <RevealPanelLocked others={row.others} absenteeCount={row.absenteeCount} />
        </div>
      )}
    </div>
  );
}
