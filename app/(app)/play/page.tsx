import { getPlayUpcoming } from "@/lib/queries/play";
import { EmptyState } from "@/components/home/EmptyState";
import { PlayTabs } from "@/components/play/PlayTabs";
import { BracketEntry } from "@/components/play/BracketEntry";
import { QuotaBanner } from "@/components/my-bets/QuotaBanner";
import { ValidateAllBanner } from "@/components/play/ValidateAllBanner";
import { MatchDayGroup } from "@/components/play/MatchDayGroup";
import { LockedRow } from "@/components/play/LockedRow";
import { LiveSubscriber } from "@/components/play/LiveSubscriber";
import styles from "./page.module.css";

// Onglet "Mes pronos" (à suivre) — SPEC_REFONTE_ONGLET_JOUER_V0_1 §3.
// Remplace l'ancien hub à cartes ET l'écran Matchs ET le segment "Récent" de
// l'ex-écran Mes pronos. Composant SERVEUR, aucun fetch client — la fenêtre,
// le tri et la dérivation d'état sont déjà calculés par
// lib/queries/play.ts::getPlayUpcoming ; cette page ne fait que composer.
//
// searchParams est une Promise en Next.js 16 — attendue avant lecture.
type SearchParams = {
  correctionMatchId?: string;
  correctionError?: string;
  betId?: string;
  betError?: string;
};

export default async function PlayUpcomingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const data = await getPlayUpcoming();

  if (!data) {
    return (
      <div className={`${styles.page} photo-page`}>
        <div className={`${styles.header} glass-card`}>
          <h1 className={styles.title}>Jouer</h1>
        </div>
        <EmptyState title="Aucune compétition en cours" subtitle="La prochaine arrive bientôt." />
      </div>
    );
  }

  const hasUpcoming = data.days.length > 0;
  const hasRecentLocked = data.recentLocked.length > 0;
  const isEmpty = !hasUpcoming && !hasRecentLocked;

  const readyMatches = data.days
    .flatMap((day) => day.matches)
    .filter((match) => match.viewStatus === "READY")
    .map((match) => ({
      matchId: match.matchId,
      label: `${match.homeTeam.abbreviation} – ${match.awayTeam.abbreviation}`,
    }));

  return (
    <div className={`${styles.page} photo-page`}>
      <div className={`${styles.header} glass-card`}>
        <h1 className={styles.title}>Jouer</h1>
        <BracketEntry />
      </div>
      <PlayTabs active="UPCOMING" />

      {isEmpty ? (
        <EmptyState
          title="Aucun match à pronostiquer ni à suivre pour l'instant"
          subtitle="Les prochaines affiches s'afficheront ici dès qu'elles seront connues."
        />
      ) : (
        <>
          <QuotaBanner quotas={data.quotas} />
          {data.readyCount > 0 && <ValidateAllBanner readyMatches={readyMatches} />}

          {data.days.map((day) => (
            <MatchDayGroup key={day.key} day={day} />
          ))}

          {hasRecentLocked && (
            <LiveSubscriber
              seed={data.recentLocked.map((row) => ({
                matchId: row.matchId,
                liveState: row.liveState,
                homeScore: row.homeScore,
                awayScore: row.awayScore,
              }))}
            >
              <div className={styles.list}>
                {data.recentLocked.map((row) => (
                  <LockedRow
                    key={row.matchId}
                    row={row}
                    returnTo="/play"
                    forceOpenPredictionCorrection={sp.correctionMatchId === row.matchId}
                    predictionCorrectionError={sp.correctionMatchId === row.matchId ? sp.correctionError : undefined}
                    forceOpenBetCorrection={Boolean(row.bet && sp.betId === row.bet.betId)}
                    betCorrectionError={row.bet && sp.betId === row.bet.betId ? sp.betError : undefined}
                  />
                ))}
              </div>
            </LiveSubscriber>
          )}
        </>
      )}
    </div>
  );
}
