import Link from "next/link";
import { getMyPredictions, type MyPredictionsMode } from "@/lib/queries/my-predictions";
import { EmptyState } from "@/components/home/EmptyState";
import { SegmentTabs } from "@/components/my-predictions/SegmentTabs";
import { FilterBar } from "@/components/my-predictions/FilterBar";
import { SeriesBetHeader } from "@/components/my-predictions/SeriesBetHeader";
import { MatchRowStatic } from "@/components/my-predictions/MatchRowStatic";
import { LiveSubscriber } from "@/components/my-predictions/LiveSubscriber";
import { buildViewPath, DEFAULT_LIMIT } from "@/components/my-predictions/urls";
import styles from "./page.module.css";

// Écran "Mes pronos" (SPEC_ECRAN_MES_PRONOS_V0_1 §1) : composant SERVEUR,
// aucun fetch client. Ancré sur les MATCHS verrouillés (§3) — la fenêtre, le
// tri, la confidentialité et la dérivation d'état sont déjà calculés par
// lib/queries/my-predictions.ts ; cette page ne fait que composer la vue et
// choisir entre les états vides (§15).
//
// searchParams est une Promise en Next.js 16 (§16.4) — attendue avant lecture.
type SearchParams = {
  tab?: string;
  date?: string;
  series?: string;
  limit?: string;
  correctionError?: string;
  correctionMatchId?: string;
};

export default async function MyPredictionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const hasFilter = Boolean(sp.date || sp.series);
  // Trois modes EXCLUSIFS (§4.3) : un filtre actif remplace toujours la
  // segmentation, quel que soit ?tab= présent par ailleurs.
  const mode: MyPredictionsMode = hasFilter ? "FILTERED" : sp.tab === "history" ? "HISTORY" : "RECENT";
  const limit = sp.limit ? Number(sp.limit) : undefined;

  const data = await getMyPredictions({ mode, date: sp.date, seriesId: sp.series, limit });

  if (!data) {
    return (
      <div className={styles.page}>
        <EmptyState title="Aucune compétition en cours" subtitle="La prochaine arrive bientôt." />
      </div>
    );
  }

  // Vue courante (sans les paramètres d'erreur) : sert de redirection après le
  // dépôt d'une requête de correction, réussie ou non (§1.1 point 3).
  const returnTo = buildViewPath({ mode, date: data.filter.date, seriesId: data.filter.seriesId, limit });

  return (
    <div className={styles.page}>
      <div className={styles.controls}>
        {mode !== "FILTERED" && <SegmentTabs active={mode === "HISTORY" ? "HISTORY" : "RECENT"} />}
        <FilterBar availableDates={data.availableDates} availableSeries={data.availableSeries} filter={data.filter} />
      </div>

      {data.seriesBet && <SeriesBetHeader header={data.seriesBet} />}

      {data.rows.length === 0 ? (
        <div className={styles.empty}>
          <EmptyState title={emptyTitle(mode)} subtitle={emptySubtitle(mode)} />
          {mode === "RECENT" && (
            <Link href={buildViewPath({ mode: "HISTORY" })} className={styles.emptyLink}>
              Voir l&rsquo;historique
            </Link>
          )}
        </div>
      ) : (
        <LiveSubscriber
          seed={data.rows.map((row) => ({
            matchId: row.matchId,
            liveState: row.liveState,
            homeScore: row.homeScore,
            awayScore: row.awayScore,
          }))}
        >
          <div className={styles.list}>
            {data.rows.map((row) => (
              <MatchRowStatic
                key={row.matchId}
                row={row}
                returnTo={returnTo}
                forceOpenCorrectionForm={sp.correctionMatchId === row.matchId}
                correctionError={sp.correctionMatchId === row.matchId ? sp.correctionError : undefined}
              />
            ))}
          </div>
        </LiveSubscriber>
      )}

      {data.hasMore && (
        <Link
          href={buildViewPath({
            mode,
            date: data.filter.date,
            seriesId: data.filter.seriesId,
            limit: (limit ?? DEFAULT_LIMIT) + DEFAULT_LIMIT,
          })}
          className={styles.loadMore}
        >
          Charger plus
        </Link>
      )}
    </div>
  );
}

function emptyTitle(mode: MyPredictionsMode): string {
  if (mode === "FILTERED") return "Aucun match pour ce filtre.";
  if (mode === "HISTORY") return "Aucun match verrouillé pour l'instant.";
  return "Aucun match verrouillé ces trois derniers jours.";
}

function emptySubtitle(mode: MyPredictionsMode): string {
  if (mode === "FILTERED") return "Retire le filtre pour voir tous tes matchs.";
  if (mode === "HISTORY") return "Tes pronos apparaîtront ici après le coup d'envoi.";
  return "Regarde du côté de l'historique.";
}
