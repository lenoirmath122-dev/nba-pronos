import { redirect } from "next/navigation";
import Link from "next/link";
import { getProfileStats } from "@/lib/queries/stats";
import { getMyLeagues } from "@/lib/queries/leagues";
import { getProfileBadges } from "@/lib/queries/badges";
import { getWeeklyPalmares } from "@/lib/queries/weeklyPalmares";
import { getServerClient } from "@/lib/supabase/server";
import { LeagueScopeChips } from "@/components/profile/LeagueScopeChips";
import { RankEvolutionChart } from "@/components/profile/RankEvolutionChart";
import { BadgesSection } from "@/components/profile/BadgesSection";
import { WeeklyPalmares } from "@/components/profile/WeeklyPalmares";
import { ProgressBar } from "@/components/bracket/ProgressBar";
import { SubPageShell } from "@/components/ui/SubPageShell";
import profileStyles from "@/components/profile/profileShared.module.css";
import styles from "./page.module.css";

// Page Stats dédiée (refonte du menu Profil, 21/10/2026) : les 6 sous-sections
// qui vivaient dans /profile?tab=stats, en onglets horizontaux. `?tab=` permet
// le lien direct (ex. /stats?tab=badges depuis le menu Profil). Le contenu de
// chaque onglet est repris tel quel de l'ancien écran.
const TABS = [
  { key: "precision", label: "Précision" },
  { key: "comparaison", label: "Comparaison" },
  { key: "evolution", label: "Évolution du classement" },
  { key: "paris", label: "Paris" },
  { key: "palmares", label: "Palmarès hebdo" },
  { key: "badges", label: "Badges" },
] as const;

type StatsTab = (typeof TABS)[number]["key"];

function parseTab(value: string | undefined): StatsTab {
  return TABS.find((t) => t.key === value)?.key ?? "precision";
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ligue?: string; profileError?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login"); // le layout (app) garde déjà la session.

  const tab = parseTab(sp.tab);

  // Une seule requête par onglet affiché : Palmarès et Badges sont à vie /
  // toutes compétitions (hors `stats`, scopée à la compétition ACTIVE).
  const needsStats = tab === "precision" || tab === "comparaison" || tab === "evolution" || tab === "paris";
  const stats = needsStats ? await getProfileStats(sp.ligue) : null;
  const statsLeagues = tab === "comparaison" ? await getMyLeagues() : [];
  const palmares = tab === "palmares" ? await getWeeklyPalmares(supabase, user.id) : null;
  const badges = tab === "badges" ? await getProfileBadges() : null;

  return (
    <SubPageShell title="Stats">
      <nav className={styles.tabs} aria-label="Sections des stats">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/stats?tab=${t.key}`}
            replace
            className={t.key === tab ? styles.tabActive : styles.tab}
            aria-current={t.key === tab ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {sp.profileError && (
        <p className={profileStyles.error} role="alert">
          {sp.profileError}
        </p>
      )}

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
              <p className={profileStyles.chartCaption}>Toujours en classement général.</p>
            </>
          ) : (
            <p className={profileStyles.fieldLabel}>Reviens dans quelques jours pour voir ta courbe d&rsquo;évolution.</p>
          )}
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

      {palmares && (
        <section className={`${profileStyles.section} glass-card`} aria-label="Palmarès hebdo">
          <WeeklyPalmares data={palmares} variant="self" />
        </section>
      )}

      {badges && (
        <section className={`${profileStyles.section} glass-card`} aria-label="Badges">
          <BadgesSection data={badges} />
        </section>
      )}
    </SubPageShell>
  );
}
