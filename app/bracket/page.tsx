import { getServerClient } from "@/lib/supabase/server";
import { getBracket, getSeriesLiveSeed } from "@/lib/queries/bracket";
import { getMyLeagues } from "@/lib/queries/leagues";
import { ScreenShell } from "@/components/nav/ScreenShell";
import { EmptyState } from "@/components/home/EmptyState";
import { BracketSummary } from "@/components/bracket/BracketSummary";
import styles from "./page.module.css";

// Bracket (vue globale de consultation) — route physique UNIQUE, hors des
// route groups (public)/(app) (T6a §3.2/§8.1), même mécanisme que
// /leaderboard : cette enveloppe fine choisit sa nav selon la session, lit
// `?arbre=` pour l'état initial de la vue B, `?ligue=` pour le filtre par
// ligue (30/07/2026, demandé par l'utilisateur), puis compose le module de
// lecture partagé + le composant de rendu partagé.
type BracketPageProps = {
  searchParams: Promise<{ arbre?: string | string[]; ligue?: string | string[] }>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BracketPage({ searchParams }: BracketPageProps) {
  const { arbre, ligue } = await searchParams;
  const initialShowTree = arbre === "1";
  const leagueId = firstValue(ligue) ?? null;

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [data, myLeagues] = await Promise.all([getBracket(leagueId), getMyLeagues()]);
  const liveSeed = data.isStructureKnown && data.competitionId ? await getSeriesLiveSeed(data.competitionId) : [];

  return (
    <ScreenShell authenticated={user !== null}>
      {data.competitionId === null ? (
        <>
          <div className={`${styles.header} hero-banner`}>
            <p className={`${styles.title} hero-banner-title`}>Bracket</p>
          </div>
          <EmptyState title="Aucune compétition en cours" subtitle="La prochaine arrive bientôt." />
        </>
      ) : !data.isStructureKnown ? (
        <>
          <div className={`${styles.header} hero-banner`}>
            <p className={`${styles.title} hero-banner-title`}>Bracket</p>
          </div>
          <EmptyState
            title="La phase finale n'est pas encore définie"
            subtitle="Les 8 qualifiés seront connus fin novembre."
          />
        </>
      ) : (
        <BracketSummary
          data={data}
          competitionName={data.competitionType === "PLAYOFFS" ? "Playoffs" : "NBA Cup"}
          initialShowTree={initialShowTree}
          liveSeed={liveSeed}
          myLeagues={myLeagues}
          canBet={user !== null}
        />
      )}
    </ScreenShell>
  );
}
