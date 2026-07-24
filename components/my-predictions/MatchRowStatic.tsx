import { TeamLogo } from "@/components/ui/TeamLogo";
import type { MyPredictionRow } from "@/lib/queries/my-predictions";
import { LiveBadgeAndScore } from "./LiveSubscriber";
import { PredictionSummary } from "./PredictionSummary";
import { RevealPanel } from "./RevealPanel";
import { AssociatedBetCard } from "./AssociatedBetCard";
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
    <div className={styles.row}>
      <div className={styles.header}>
        <span className={styles.teams}>
          <TeamLogo abbreviation={row.home.abbreviation} alt={row.home.name} size={20} />
          {row.home.abbreviation} – {row.away.abbreviation}
          <TeamLogo abbreviation={row.away.abbreviation} alt={row.away.name} size={20} />
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
  );
}
