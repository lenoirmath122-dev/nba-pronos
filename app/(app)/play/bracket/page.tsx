import Link from "next/link";
import { getBracketFillData } from "@/lib/queries/bracket-fill";
import { EmptyState } from "@/components/home/EmptyState";
import { ProgressBar } from "@/components/bracket/ProgressBar";
import { RoundTabs } from "@/components/bracket-fill/RoundTabs";
import { BracketFillBoard } from "@/components/bracket-fill/BracketFillBoard";
import styles from "./page.module.css";

// Écran Bracket personnel — remplissage (SPEC_ECRAN_BRACKET_PERSONNEL_V0_1
// §1/§2). Composant SERVEUR : cadrage (séries, cascade des candidats, pick du
// joueur) lu par lib/queries/bracket-fill.ts, passé en props à la seule
// feuille cliente (BracketFillBoard).
//
// searchParams est une Promise en Next.js 16 (AGENTS.md) — attendue avant
// lecture. `round` sélectionne le tour affiché (§6).
type SearchParams = { round?: string };

export default async function BracketFillPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const data = await getBracketFillData();

  if (data.competitionId === null) {
    return (
      <div className={styles.page}>
        <div className={`${styles.header} hero-banner`}>
          <h1 className={`${styles.title} hero-banner-title`}>Mon bracket</h1>
        </div>
        <EmptyState title="Aucune compétition en cours" subtitle="La prochaine arrive bientôt." />
      </div>
    );
  }

  if (!data.isStructureKnown) {
    const isCup = data.competitionType === "NBA_CUP";
    return (
      <div className={styles.page}>
        <div className={`${styles.header} hero-banner`}>
          <h1 className={`${styles.title} hero-banner-title`}>Mon bracket</h1>
        </div>
        <EmptyState
          title={isCup ? "La phase finale n'est pas encore définie" : "Le 1er tour n'est pas encore officiel"}
          subtitle={
            isCup ? "Les 8 qualifiés seront connus fin novembre." : "Le 1er tour n'est pas encore officiel."
          }
        />
      </div>
    );
  }

  const activeRoundKey =
    sp.round && data.rounds.some((round) => round.key === sp.round) ? sp.round : data.rounds[0]?.key;
  const activeRound = data.rounds.find((round) => round.key === activeRoundKey);

  return (
    <div className={styles.page}>
      <div className={`${styles.header} hero-banner`}>
        <h1 className={`${styles.title} hero-banner-title`}>Mon bracket</h1>
      </div>
      <ProgressBar filledCount={data.filledCount} totalCount={data.totalCount} />
      <RoundTabs rounds={data.rounds} activeKey={activeRoundKey} />

      {data.isDeadlinePassed ? (
        <div className={styles.locked}>
          <p>Ton bracket est verrouillé.</p>
          <Link href="/bracket" className={styles.lockedLink}>
            Voir le bracket global
          </Link>
        </div>
      ) : (
        activeRound && (
          <BracketFillBoard
            series={activeRound.series}
            competitionType={data.competitionType}
            isValidated={data.isValidated}
            isAutoValidated={data.isAutoValidated}
          />
        )
      )}
    </div>
  );
}
