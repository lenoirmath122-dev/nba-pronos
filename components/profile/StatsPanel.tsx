import { StatsTabsNav } from "@/components/stats/StatsTabsNav";
import { getProfileStats } from "@/lib/queries/stats";
import { getMyLeagues } from "@/lib/queries/leagues";
import { getWeeklyPalmares } from "@/lib/queries/weeklyPalmares";
import { getServerClient } from "@/lib/supabase/server";
import { LeagueScopeChips } from "@/components/profile/LeagueScopeChips";
import { RankEvolutionChart } from "@/components/profile/RankEvolutionChart";
import { BetHistory } from "@/components/profile/BetHistory";
import { WeeklyPointsEvolution } from "@/components/profile/WeeklyPointsEvolution";
import { getMyBetHistory } from "@/lib/queries/betHistory";
import { getPointsEvolution } from "@/lib/queries/pointsEvolution";
import { WeeklyPalmares } from "@/components/profile/WeeklyPalmares";
import { ProgressBar } from "@/components/bracket/ProgressBar";
import profileStyles from "@/components/profile/profileShared.module.css";

// Onglet Stats de « Mon profil » (Lot 3a) : le contenu de l'ancienne page
// /stats, repris tel quel (refonte de l'onglet = chantier séparé). Les 5
// sections se choisissent par `?section=` ; les badges ont leur propre onglet.
export const STATS_SECTIONS = [
  { key: "precision", label: "Précision" },
  { key: "comparaison", label: "Comparaison" },
  { key: "evolution", label: "Évolution" },
  { key: "paris", label: "Paris" },
  { key: "palmares", label: "Palmarès hebdo" },
] as const;

export type StatsSection = (typeof STATS_SECTIONS)[number]["key"];

export function parseStatsSection(value: string | undefined): StatsSection {
  return STATS_SECTIONS.find((t) => t.key === value)?.key ?? "precision";
}

export const STATS_SECTION_BASE = "/profile?tab=stats&section=";

export async function StatsPanel({ userId, section, ligue }: { userId: string; section: StatsSection; ligue?: string }) {
  const tab = section;
  // Une seule requête par section affichée : le palmarès est à vie / toutes
  // compétitions, `stats` est scopée à la compétition ACTIVE.
  const needsStats = tab === "precision" || tab === "comparaison" || tab === "evolution" || tab === "paris";
  const stats = needsStats ? await getProfileStats(ligue) : null;
  const statsLeagues = tab === "comparaison" || tab === "evolution" ? await getMyLeagues() : [];
  const pointsEvolution = tab === "evolution" ? await getPointsEvolution(ligue) : null;
  const betHistory = tab === "paris" ? await getMyBetHistory() : null;
  const palmares = tab === "palmares" ? await getWeeklyPalmares(await getServerClient(), userId) : null;

  return (
    <>
      <StatsTabsNav tabs={STATS_SECTIONS} active={tab} basePath={STATS_SECTION_BASE} />

      {needsStats && stats && !stats.hasActiveCompetition && (
        <section className={`${profileStyles.section} glass-card`}>
          <p className={profileStyles.fieldLabel}>Aucune compétition en cours.</p>
        </section>
      )}

      {stats?.hasActiveCompetition && tab === "precision" && (
        <section className={`${profileStyles.section} glass-card`} aria-label="Précision">
          <div className={profileStyles.totalHero}>
            <span className={profileStyles.totalHeroValue}>{stats.pointsBreakdown.totalPoints}</span>
            <span className={profileStyles.totalHeroLabel}>points cette compétition</span>
          </div>
          {stats.accuracy.totalScoredPredictions === 0 ? (
            <p className={profileStyles.fieldLabel}>Pas encore de match scoré cette compétition.</p>
          ) : (
            <>
              <ProgressBar
                filledCount={stats.accuracy.correctWinners}
                totalCount={stats.accuracy.totalScoredPredictions}
                label={`Précision bons vainqueurs : ${stats.accuracy.correctWinners} sur ${stats.accuracy.totalScoredPredictions}`}
              />
              <ProgressBar
                filledCount={stats.accuracy.exactMargins}
                totalCount={stats.accuracy.totalScoredPredictions}
                label={`Précision écarts exacts : ${stats.accuracy.exactMargins} sur ${stats.accuracy.totalScoredPredictions}`}
              />
            </>
          )}
          <div className={profileStyles.statGrid}>
            <div className={profileStyles.statCard}>
              <span className={profileStyles.statCardLabel}>Points matchs</span>
              <span className={profileStyles.statCardValue}>{stats.pointsBreakdown.matchesPoints}</span>
            </div>
            <div className={profileStyles.statCard}>
              <span className={profileStyles.statCardLabel}>Points bracket</span>
              <span className={profileStyles.statCardValue}>{stats.pointsBreakdown.bracketPoints}</span>
            </div>
            <div className={profileStyles.statCard}>
              <span className={profileStyles.statCardLabel}>Points paris</span>
              <span className={profileStyles.statCardValue}>{stats.pointsBreakdown.betsPoints}</span>
            </div>
          </div>
        </section>
      )}

      {stats?.hasActiveCompetition && tab === "comparaison" && (
        <section className={`${profileStyles.section} glass-card`} aria-label="Comparaison">
          <LeagueScopeChips myLeagues={statsLeagues} activeLeagueId={stats.comparison.scopeLeagueId} />
          <div className={profileStyles.compareRow}>
            <span>
              <span className={profileStyles.compareRank}>
                {stats.rank.value !== null ? `#${stats.rank.value}` : "—"}
              </span>
              <span className={profileStyles.compareRankTotal}>
                {" "}
                / {stats.rank.totalPlayers} joueur{stats.rank.totalPlayers > 1 ? "s" : ""}
              </span>
            </span>
            <span className={profileStyles.compareDelta}>
              {stats.comparison.deltaVsAverage >= 0 ? "+" : ""}
              {stats.comparison.deltaVsAverage} pts vs moyenne ({stats.comparison.othersAveragePoints})
            </span>
          </div>
        </section>
      )}

      {stats?.hasActiveCompetition && tab === "evolution" && (
        <section className={`${profileStyles.section} glass-card`} aria-label="Évolution du classement">
          {stats.evolution.series.length >= 2 ? (
            <>
              <div className={profileStyles.chartWrapper}>
                <RankEvolutionChart series={stats.evolution.series} />
              </div>
              <p className={profileStyles.chartCaption}>Courbe du rang en classement général.</p>
            </>
          ) : (
            <p className={profileStyles.fieldLabel}>Reviens dans quelques jours pour voir ta courbe d&rsquo;évolution.</p>
          )}
        </section>
      )}

      {stats?.hasActiveCompetition && tab === "evolution" && pointsEvolution && (
        <section className={`${profileStyles.section} glass-card`} aria-label="Points par semaine">
          <LeagueScopeChips myLeagues={statsLeagues} activeLeagueId={ligue ?? null} section="evolution" />
          <WeeklyPointsEvolution data={pointsEvolution} />
        </section>
      )}

      {stats?.hasActiveCompetition && tab === "paris" && (
        <section className={`${profileStyles.section} glass-card`} aria-label="Paris">
          {stats.betRecord.resolvedCount === 0 ? (
            <p className={profileStyles.fieldLabel}>Aucun pari résolu pour l&rsquo;instant.</p>
          ) : (
            <>
              <div className={profileStyles.betRecordRow}>
                <div className={profileStyles.betStat}>
                  <span className={profileStyles.betStatValueWon}>{stats.betRecord.wonCount}</span>
                  <span className={profileStyles.betStatLabel}>Gagnés</span>
                </div>
                <div className={profileStyles.betStat}>
                  <span className={profileStyles.betStatValueLost}>{stats.betRecord.lostCount}</span>
                  <span className={profileStyles.betStatLabel}>Perdus</span>
                </div>
                <div className={profileStyles.betStat}>
                  <span className={profileStyles.betStatValue}>{stats.betRecord.winRatePct}%</span>
                  <span className={profileStyles.betStatLabel}>Réussite</span>
                </div>
              </div>
              {stats.betRecord.bestWin && (
                <div className={profileStyles.bestWin}>
                  <span className={profileStyles.bestWinTag}>Plus gros coup</span>
                  <span className={profileStyles.bestWinDesc}>« {stats.betRecord.bestWin.description} »</span>
                  <span className={profileStyles.bestWinMeta}>
                    {stats.betRecord.bestWin.difficultyLabel} · +{stats.betRecord.bestWin.points} pts
                  </span>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {betHistory && (
        <section className={`${profileStyles.section} glass-card`} aria-label="Historique des paris">
          <h2 className={profileStyles.fieldLabel}>Historique de tous mes paris</h2>
          {betHistory.length === 0 ? (
            <p className={profileStyles.fieldLabel}>Aucun pari résolu pour l&rsquo;instant.</p>
          ) : (
            <BetHistory items={betHistory} />
          )}
        </section>
      )}

      {palmares && (
        <section className={`${profileStyles.section} glass-card`} aria-label="Palmarès hebdo">
          <WeeklyPalmares data={palmares} variant="self" />
        </section>
      )}
    </>
  );
}
