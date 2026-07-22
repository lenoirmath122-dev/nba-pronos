import { getServerClient } from "@/lib/supabase/server";
import { getLeaderboard, type SortKey } from "@/lib/queries/leaderboard";
import { ScreenShell } from "@/components/nav/ScreenShell";
import { SortChips } from "@/components/leaderboard/SortChips";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { StickyMeBar } from "@/components/leaderboard/StickyMeBar";
import { EmptyState } from "@/components/home/EmptyState";
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

type LeaderboardPageProps = {
  searchParams: Promise<{ tri?: string | string[] }>;
};

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  const { tri } = await searchParams;
  const sortKey = parseSortKey(tri);

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const data = await getLeaderboard(sortKey);

  const showStickyBar = data.rankedCount > 20 && data.currentUserRank !== null;
  const currentUserRow = data.rows.find((row) => row.isCurrentUser);

  return (
    <ScreenShell authenticated={user !== null}>
      <div className={styles.page}>
        {data.competitionId === null ? (
          <EmptyState title="Aucune compétition en cours" subtitle="La prochaine arrive bientôt." />
        ) : (
          <>
            <div className={styles.header}>
              <p className={styles.title}>Classement</p>
              <p className={styles.competitionName}>{data.competitionName}</p>
            </div>

            <SortChips active={sortKey} />

            {data.rows.length === 0 ? (
              <EmptyState
                title="Personne n'a encore marqué"
                subtitle="Le classement s'affichera dès les premiers pronos."
              />
            ) : (
              <LeaderboardTable rows={data.rows} sortKey={sortKey} />
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
