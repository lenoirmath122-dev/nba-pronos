import { TeamLogo } from "@/components/ui/TeamLogo";
import type { MyPredictionRow } from "@/lib/queries/my-predictions";
import { LiveBadgeAndScore } from "./LiveSubscriber";
import { PredictionSummary } from "./PredictionSummary";
import { RevealPanel } from "./RevealPanel";
import { AssociatedBetCard } from "./AssociatedBetCard";
import { OtherBetsModal } from "./OtherBetsModal";
import { CorrectionRequestForm } from "./CorrectionRequestForm";
import styles from "./MatchRowStatic.module.css";

// Ligne d'un match verrouillé (§6) — SERVEUR. Aucune saisie de prono : le
// verrouillage au coup d'envoi est irréversible (§17), cet écran consulte, il
// ne rouvre rien. Le seul bloc interactif (badge EN DIRECT + score) est confié
// à LiveBadgeAndScore, qui lit le contexte posé par LiveSubscriber (§1.1).

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

type MatchRowStaticProps = {
  row: MyPredictionRow;
  returnTo: string;
  forceOpenCorrectionForm: boolean;
  correctionError?: string;
};

export function MatchRowStatic({ row, returnTo, forceOpenCorrectionForm, correctionError }: MatchRowStaticProps) {
  return (
    <div className={`${styles.row} glass-card`}>
      <div className={styles.header}>
        <span className={styles.teams}>
          <TeamLogo abbreviation={row.home.abbreviation} alt={row.home.name} size={24} />
          {row.home.abbreviation} – {row.away.abbreviation}
          <TeamLogo abbreviation={row.away.abbreviation} alt={row.away.name} size={24} />
        </span>
        <span className={styles.gameNumber}>Match {row.gameNumber}</span>
        <LiveBadgeAndScore
          matchId={row.matchId}
          fallback={{ liveState: row.liveState, homeScore: row.homeScore, awayScore: row.awayScore }}
          scheduledAtLabel={formatKickoff(row.scheduledAt)}
        />
      </div>

      <PredictionSummary prediction={row.prediction} />

      {row.bet && <AssociatedBetCard bet={row.bet} />}

      {/* Repliés sous UN SEUL déclencheur (demandé par l'utilisateur,
          30/07/2026) : ces 3 blocs prenaient chacun une ligne visible en
          permanence sur CHAQUE match, même quand leur propre contenu était
          déjà replié (OtherBetsModal = popup, CorrectionRequestForm/
          RevealPanel = <details>). Forcé ouvert si on revient ici après une
          requête de correction en erreur sur CE match précis, sinon
          l'utilisateur ne verrait jamais le message d'erreur. */}
      <details className={styles.more} open={forceOpenCorrectionForm}>
        <summary className={styles.moreSummary}>Plus d&rsquo;options</summary>
        <div className={styles.moreContent}>
          <OtherBetsModal bets={row.otherBets} />

          <CorrectionRequestForm
            matchId={row.matchId}
            home={row.home}
            away={row.away}
            correctionRequest={row.correctionRequest}
            returnTo={returnTo}
            forceOpen={forceOpenCorrectionForm}
            error={correctionError}
          />

          <RevealPanel others={row.others} absenteeCount={row.absenteeCount} />
        </div>
      </details>
    </div>
  );
}
