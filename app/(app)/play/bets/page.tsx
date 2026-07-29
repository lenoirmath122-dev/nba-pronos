import Link from "next/link";
import { getMyBets } from "@/lib/queries/my-bets";
import { SegmentTabs } from "@/components/my-bets/SegmentTabs";
import { QuotaBanner } from "@/components/my-bets/QuotaBanner";
import { MyBetRow } from "@/components/my-bets/MyBetRow";
import styles from "./page.module.css";

// Écran Mes paris (SPEC_ECRAN_MES_PARIS_V0_1, CLOSE) — 8ème écran du hub
// joueur, consultation PERSONNELLE uniquement (§2 de la spec). Index de
// /play/bets — new/ et [id]/edit/ (Nouveau pari) restent inchangés,
// cet écran ne fait QUE lier vers eux.

type SearchParams = { segment?: string; betError?: string; betId?: string };

export default async function MyBetsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const segment: "ONGOING" | "FINISHED" = sp.segment === "FINISHED" ? "FINISHED" : "ONGOING";

  const data = await getMyBets();

  if (!data.competitionId) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Mes paris</h1>
        <p className={styles.empty}>Aucune compétition en cours.</p>
      </div>
    );
  }

  const hasAnyBet = data.ongoing.length > 0 || data.finished.length > 0;

  if (!hasAnyBet) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Mes paris</h1>
        <p className={styles.empty}>Tu n&rsquo;as encore aucun pari.</p>
        <Link href="/play/bets/new" className={styles.newLink}>
          Créer un pari
        </Link>
      </div>
    );
  }

  const bets = segment === "ONGOING" ? data.ongoing : data.finished;

  return (
    <div className={styles.page}>
      <header className={`${styles.header} hero-banner`}>
        <h1 className={`${styles.title} hero-banner-title`}>Mes paris</h1>
        <Link href="/play/bets/new" className={styles.newLink}>
          Créer un pari
        </Link>
      </header>

      <SegmentTabs active={segment} />

      {segment === "ONGOING" && <QuotaBanner quotas={data.quotas} />}

      {bets.length === 0 ? (
        <p className={styles.empty}>
          {segment === "ONGOING" ? "Aucun pari en cours." : "Aucun pari terminé pour l’instant."}
        </p>
      ) : (
        <div className={styles.list}>
          {bets.map((bet) => (
            <MyBetRow
              key={bet.betId}
              bet={bet}
              forceOpenCorrection={sp.betId === bet.betId}
              correctionError={sp.betId === bet.betId ? sp.betError : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
