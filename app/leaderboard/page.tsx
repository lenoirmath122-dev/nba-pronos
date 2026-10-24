import { getServerClient } from "@/lib/supabase/server";
import { getLeaderboard, type SortDirection, type SortKey } from "@/lib/queries/leaderboard";
import { getRowShowcases } from "@/lib/queries/badges";
import { PlayerIdentity } from "@/components/player/PlayerIdentity";
import { getWeeklyLeaderboard } from "@/lib/queries/weeklyLeaderboard";
import { getMyLeagues } from "@/lib/queries/leagues";
import { parseView } from "@/lib/leaderboard/href";
import { readWeeklyRankingFlag } from "@/lib/weekly/flag";
import { formatDayLabel } from "@/lib/weekly/currentWeek";
import { ScreenShell } from "@/components/nav/ScreenShell";
import { LeagueScopeChips } from "@/components/leaderboard/LeagueScopeChips";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { LeaderboardViewTabs } from "@/components/leaderboard/LeaderboardViewTabs";
import { WeeklyChampionBanner } from "@/components/leaderboard/WeeklyChampionBanner";
import { WeeklyLeaderboardList } from "@/components/leaderboard/WeeklyLeaderboardList";
import { StickyMeBar } from "@/components/leaderboard/StickyMeBar";
import { EmptyState } from "@/components/home/EmptyState";
import { RuleHelpButton } from "@/components/regles/RuleHelpButton";
import { RankingTiebreakList } from "@/components/regles/RankingTiebreakList";
import styles from "./page.module.css";
import { pageMetadata } from "@/lib/seo";

// Classement — route physique UNIQUE, hors des route groups (public)/(app)
// (T6a §3.2/§8.1) : cette enveloppe fine choisit elle-même sa nav (réduite
// ou 4 onglets) selon la présence d'une session, puis compose le module de
// lecture partagé + le composant de rendu partagé. Aucun fetch client,
// aucune logique métier ici — tout est déjà calculé par
// lib/queries/leaderboard.ts (vue Générale) ou lib/queries/weeklyLeaderboard.ts
// (vue Semaine, uniquement quand competitions.weekly_ranking est actif).
const SORT_KEYS: SortKey[] = ["total", "matches", "bracket", "bets", "form"];

function parseSortKey(value: string | string[] | undefined): SortKey {
  return SORT_KEYS.includes(value as SortKey) ? (value as SortKey) : "total";
}

// Bascule croissant/décroissant (14/08/2026) : `?ordre=asc`, absent = "desc"
// (repli, même affichage qu'avant l'ajout de cette bascule).
function parseSortDirection(value: string | string[] | undefined): SortDirection {
  return value === "asc" ? "asc" : "desc";
}

type LeaderboardPageProps = {
  searchParams: Promise<{
    tri?: string | string[];
    ligue?: string | string[];
    ordre?: string | string[];
    vue?: string | string[];
  }>;
};

function parseLeagueId(value: string | string[] | undefined): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value;
}

export const metadata = pageMetadata({
  title: "Classement",
  path: "/leaderboard",
  description: "Le classement général des joueurs Panier Ballon.",
});

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  const { tri, ligue, ordre, vue } = await searchParams;
  const sortKey = parseSortKey(tri);
  const leagueId = parseLeagueId(ligue);
  const sortDirection = parseSortDirection(ordre);

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Le classement hebdo est facultatif : sans compétition active, ou avec
  // `weekly_ranking` inactif (ou colonne absente), l'écran est exactement
  // celui d'avant — pas d'onglets, vue Générale. getMyLeagues() lit sa propre
  // session (RLS) : rien à filtrer pour un visiteur, elle renvoie déjà [].
  const [{ data: activeCompetition }, myLeagues] = await Promise.all([
    supabase
      .from("competitions")
      .select("id, name")
      .eq("status", "ACTIVE")
      .maybeSingle<{ id: string; name: string }>(),
    getMyLeagues(),
  ]);
  const weeklyActive = activeCompetition ? await readWeeklyRankingFlag(supabase, activeCompetition.id) : false;
  const view = parseView(vue, tri, ordre, weeklyActive);

  if (activeCompetition && view === "semaine") {
    const weekly = await getWeeklyLeaderboard(supabase, {
      competitionId: activeCompetition.id,
      leagueId,
      userId: user?.id ?? null,
    });
    const showStickyBar = weekly.rankedCount > 20 && weekly.currentUserRank !== null;
    const currentUserRow = weekly.rows.find((row) => row.isCurrentUser);
    // Une seule salve pour toute la liste (pas une requête par ligne).
    const showcases = await getRowShowcases(weekly.rows.map((row) => row.userId), 3);

    return (
      <ScreenShell authenticated={user !== null}>
        <div className={`${styles.page} photo-page photo-page-dim`}>
          <div className={`${styles.header} glass-card`}>
            <div className={styles.titleRow}>
              <p className={styles.title}>Classement</p>
              <RuleHelpButton title="Ordre de départage" label="Comment sont départagées les égalités">
                <RankingTiebreakList />
              </RuleHelpButton>
            </div>
            <p className={styles.competitionName}>
              {activeCompetition.name}
              {weekly.scopeLeagueName ? ` — ${weekly.scopeLeagueName}` : ""}
            </p>
          </div>

          <LeaderboardViewTabs active="semaine" leagueId={weekly.scopeLeagueId} />
          <LeagueScopeChips myLeagues={myLeagues} activeLeagueId={weekly.scopeLeagueId} sortKey="total" vue="semaine" />

          <p className={styles.period}>
            Depuis {formatDayLabel(weekly.weekStart)} 10 h · {weekly.countdown}
          </p>
          {weekly.late && weekly.startSnapshotDate && (
            <p className={styles.period}>Compteurs partis du {formatDayLabel(weekly.startSnapshotDate)}.</p>
          )}

          <WeeklyChampionBanner lastChampions={weekly.lastChampions} />

          {weekly.state === "error" ? (
            <EmptyState title="Classement de la semaine indisponible" subtitle="Réessaie dans un instant." />
          ) : weekly.state === "pending" ? (
            <EmptyState
              title="La semaine vient de commencer"
              subtitle="Le classement s'affiche dès la prochaine mise à jour."
            />
          ) : weekly.rows.length === 0 ? (
            <EmptyState
              title={weekly.scopeLeagueId ? "Personne dans cette ligue n'a encore marqué" : "Personne n'a encore marqué"}
              subtitle="Le classement s'affichera dès les premiers pronos."
            />
          ) : (
            <WeeklyLeaderboardList rows={weekly.rows} showcases={showcases} tiebreakAvailable={weekly.tiebreakAvailable} />
          )}
        </div>

        {showStickyBar && currentUserRow && (
          <StickyMeBar
            rank={currentUserRow.rank}
            identity={
              <PlayerIdentity
                userId={currentUserRow.userId}
                pseudo={currentUserRow.pseudo}
                size="bar"
                linkToProfile={false}
                showcase={showcases.get(currentUserRow.userId)}
                maxBadges={1}
              />
            }
            totalPoints={currentUserRow.points}
          />
        )}
      </ScreenShell>
    );
  }

  const data = await getLeaderboard(sortKey, leagueId, sortDirection);
  // Posé seulement quand les onglets existent : sinon les liens restent ceux
  // d'avant (sans `vue`).
  const tabsVue = weeklyActive ? ("general" as const) : undefined;

  const showStickyBar = data.rankedCount > 20 && data.currentUserRank !== null;
  const currentUserRow = data.rows.find((row) => row.isCurrentUser);
  const showcases = await getRowShowcases(data.rows.map((row) => row.userId), 3);

  return (
    <ScreenShell authenticated={user !== null}>
      <div className={`${styles.page} photo-page photo-page-dim`}>
        {data.competitionId === null ? (
          <>
            <div className={`${styles.header} glass-card`}>
              <p className={styles.title}>Classement</p>
            </div>
            {/* Sélecteur affiché même sans compétition active (demandé par
                l'utilisateur, 30/07/2026) : confirme que les ligues existent
                déjà, avant même la prochaine compétition. Rien à filtrer tant
                qu'il n'y a pas de classement — le tableau (et ses en-têtes
                triables) reste, lui, absent. */}
            <LeagueScopeChips myLeagues={myLeagues} activeLeagueId={data.scopeLeagueId} sortKey={sortKey} sortDirection={sortDirection} />
            <EmptyState title="Aucune compétition en cours" subtitle="La prochaine arrive bientôt." />
          </>
        ) : (
          <>
            <div className={`${styles.header} glass-card`}>
              <div className={styles.titleRow}>
                <p className={styles.title}>Classement</p>
                <RuleHelpButton title="Ordre de départage" label="Comment sont départagées les égalités">
                  <RankingTiebreakList />
                </RuleHelpButton>
              </div>
              <p className={styles.competitionName}>
                {data.competitionName}
                {data.scopeLeagueName ? ` — ${data.scopeLeagueName}` : ""}
              </p>
            </div>

            {weeklyActive && <LeaderboardViewTabs active="general" leagueId={data.scopeLeagueId} />}

            <LeagueScopeChips
              myLeagues={myLeagues}
              activeLeagueId={data.scopeLeagueId}
              sortKey={sortKey}
              sortDirection={sortDirection}
              vue={tabsVue}
            />

            {data.rows.length === 0 ? (
              <EmptyState
                title={data.scopeLeagueId ? "Personne dans cette ligue n'a encore marqué" : "Personne n'a encore marqué"}
                subtitle="Le classement s'affichera dès les premiers pronos."
              />
            ) : (
              <LeaderboardTable
                rows={data.rows}
                showcases={showcases}
                sortKey={sortKey}
                sortDirection={data.sortDirection}
                leagueId={data.scopeLeagueId}
                vue={tabsVue}
              />
            )}
          </>
        )}
      </div>

      {showStickyBar && currentUserRow && (
        <StickyMeBar
          rank={currentUserRow.rank}
          identity={
            <PlayerIdentity
              userId={currentUserRow.userId}
              pseudo={currentUserRow.pseudo}
              size="bar"
              linkToProfile={false}
              showcase={showcases.get(currentUserRow.userId)}
              maxBadges={1}
            />
          }
          totalPoints={currentUserRow.totalPoints}
        />
      )}
    </ScreenShell>
  );
}
