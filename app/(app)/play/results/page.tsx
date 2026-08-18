import Link from "next/link";
import { getPlayResults, DEFAULT_RESULTS_LIMIT } from "@/lib/queries/play";
import { getMyLeagues } from "@/lib/queries/leagues";
import { EmptyState } from "@/components/home/EmptyState";
import { PlayTabs } from "@/components/play/PlayTabs";
import { BracketEntry } from "@/components/play/BracketEntry";
import { DateStrip } from "@/components/play/DateStrip";
import { FilterBar } from "@/components/play/FilterBar";
import { LeagueScopeChips } from "@/components/play/LeagueScopeChips";
import { LockedRow } from "@/components/play/LockedRow";
import { buildResultsPath } from "@/components/play/urls";
import styles from "./page.module.css";

// Onglet "Résultats" — SPEC_REFONTE_ONGLET_JOUER_V0_1 §5. Remplace le segment
// "Historique" de l'ex-écran Mes pronos ET le segment "Terminés" de l'ex-
// écran Mes paris (qui devient une conséquence de la segmentation par match,
// §5.3 : un pari WON/LOST/REJECTED/CANCELLED sur un match récent reste dans
// Mes pronos, pas ici). Composant SERVEUR, aucun fetch client.
//
// searchParams est une Promise en Next.js 16 — attendue avant lecture.
type SearchParams = {
  date?: string;
  series?: string;
  limit?: string;
  ligue?: string;
  correctionMatchId?: string;
  correctionError?: string;
  betId?: string;
  betError?: string;
};

export default async function PlayResultsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const limit = sp.limit ? Number(sp.limit) : undefined;

  const [data, myLeagues] = await Promise.all([
    getPlayResults({ date: sp.date, seriesId: sp.series, limit, leagueId: sp.ligue ?? null }),
    getMyLeagues(),
  ]);

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

  const filter = { date: sp.date ?? null, seriesId: sp.series ?? null };
  const hasFilter = Boolean(filter.date || filter.seriesId);

  // Sert de redirection après le dépôt d'une requête de correction (prono ou
  // pari), réussie ou non — sans les paramètres d'erreur.
  const returnTo = buildResultsPath({ date: filter.date, seriesId: filter.seriesId, limit, leagueId: data.scopeLeagueId });

  return (
    <div className={`${styles.page} photo-page`}>
      <div className={`${styles.header} glass-card`}>
        <h1 className={styles.title}>Jouer</h1>
        <BracketEntry />
      </div>
      <PlayTabs active="RESULTS" />

      <LeagueScopeChips
        myLeagues={myLeagues}
        activeLeagueId={data.scopeLeagueId}
        date={filter.date}
        seriesId={filter.seriesId}
        limit={limit}
      />
      <DateStrip dates={data.availableDates} activeDate={filter.date} seriesId={filter.seriesId} leagueId={data.scopeLeagueId} />
      <FilterBar availableSeries={data.availableSeries} seriesId={filter.seriesId} date={filter.date} leagueId={data.scopeLeagueId} />

      {data.rows.length === 0 ? (
        <EmptyState
          title={hasFilter ? "Aucun match pour ce filtre." : "Aucun match verrouillé pour l'instant."}
          subtitle={hasFilter ? "Retire le filtre pour voir tout l'historique." : "Tes pronos apparaîtront ici après le coup d'envoi."}
        />
      ) : (
        <div className={styles.list}>
          {data.rows.map((row) => (
            <LockedRow
              key={row.matchId}
              row={row}
              returnTo={returnTo}
              forceOpenPredictionCorrection={sp.correctionMatchId === row.matchId}
              predictionCorrectionError={sp.correctionMatchId === row.matchId ? sp.correctionError : undefined}
              forceOpenBetCorrection={Boolean(row.bet && sp.betId === row.bet.betId)}
              betCorrectionError={row.bet && sp.betId === row.bet.betId ? sp.betError : undefined}
            />
          ))}
        </div>
      )}

      {data.hasMore && (
        <Link
          href={buildResultsPath({
            date: filter.date,
            seriesId: filter.seriesId,
            limit: (limit ?? DEFAULT_RESULTS_LIMIT) + DEFAULT_RESULTS_LIMIT,
            leagueId: data.scopeLeagueId,
          })}
          className={styles.loadMore}
        >
          Charger plus
        </Link>
      )}
    </div>
  );
}
