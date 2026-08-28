import { getServerClient } from "@/lib/supabase/server";
import { getLeaderboard, type SortDirection, type SortKey } from "@/lib/queries/leaderboard";
import { getMyLeagues } from "@/lib/queries/leagues";
import { ScreenShell } from "@/components/nav/ScreenShell";
import { LeagueScopeChips } from "@/components/leaderboard/LeagueScopeChips";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { StickyMeBar } from "@/components/leaderboard/StickyMeBar";
import { EmptyState } from "@/components/home/EmptyState";
import { RuleHelpButton } from "@/components/regles/RuleHelpButton";
import { RankingTiebreakList } from "@/components/regles/RankingTiebreakList";
import styles from "./page.module.css";

// Classement — route physique UNIQUE, hors des route groups (public)/(app)
// (T6a §3.2/§8.1) : cette enveloppe fine choisit elle-même sa nav (réduite
// ou 4 onglets) selon la présence d'une session, puis compose le module de
// lecture partagé + le composant de rendu partagé. Aucun fetch client,
// aucune logique métier ici — tout est déjà calculé par
// lib/queries/leaderboard.ts.
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
  searchParams: Promise<{ tri?: string | string[]; ligue?: string | string[]; ordre?: string | string[] }>;
};

function parseLeagueId(value: string | string[] | undefined): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value;
}

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  const { tri, ligue, ordre } = await searchParams;
  const sortKey = parseSortKey(tri);
  const leagueId = parseLeagueId(ligue);
  const sortDirection = parseSortDirection(ordre);

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // getMyLeagues() lit sa propre session (RLS) : rien à filtrer pour un
  // visiteur, elle renvoie déjà [] sans utilisateur authentifié.
  const [data, myLeagues] = await Promise.all([
    getLeaderboard(sortKey, leagueId, sortDirection),
    getMyLeagues(),
  ]);

  const showStickyBar = data.rankedCount > 20 && data.currentUserRank !== null;
  const currentUserRow = data.rows.find((row) => row.isCurrentUser);

  return (
    <ScreenShell authenticated={user !== null}>
      <div className={`${styles.page} photo-page`}>
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

            <LeagueScopeChips myLeagues={myLeagues} activeLeagueId={data.scopeLeagueId} sortKey={sortKey} sortDirection={sortDirection} />

            {data.rows.length === 0 ? (
              <EmptyState
                title={data.scopeLeagueId ? "Personne dans cette ligue n'a encore marqué" : "Personne n'a encore marqué"}
                subtitle="Le classement s'affichera dès les premiers pronos."
              />
            ) : (
              <LeaderboardTable
                rows={data.rows}
                sortKey={sortKey}
                sortDirection={data.sortDirection}
                leagueId={data.scopeLeagueId}
              />
            )}
          </>
        )}
      </div>

      {showStickyBar && currentUserRow && (
        <StickyMeBar
          rank={currentUserRow.rank}
          pseudo={currentUserRow.pseudo}
          totalPoints={currentUserRow.totalPoints}
        />
      )}
    </ScreenShell>
  );
}
