import { getNewBetFormData } from "@/lib/queries/bets";
import { EmptyState } from "@/components/home/EmptyState";
import { BetForm } from "@/components/bets/BetForm";
import styles from "./page.module.css";

// Écran Nouveau pari — création (SPEC_ECRAN_NOUVEAU_PARI_V0_1 §1/§2). Composant
// SERVEUR : le cadrage (séries/matchs ouverts, quotas) est lu par
// lib/queries/bets.ts et passé en props à la SEULE feuille cliente (BetForm).
//
// searchParams est une Promise en Next.js 16 (AGENTS.md) — attendue avant
// lecture. `matchId` = raccourci depuis Matchs (§2, contexte A) ; `seriesId`
// = raccourci depuis le Bracket global (04/08/2026, demandé par
// l'utilisateur, même patron) ; aucun des deux = hub Mes paris (§2,
// contexte B).
type SearchParams = { matchId?: string; seriesId?: string };

export default async function NewBetPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const data = await getNewBetFormData(sp.matchId ?? null, sp.seriesId ?? null);

  if (data.competitionId === null || data.bootstrap === null) {
    return (
      <div className={`${styles.page} photo-page`}>
        <div className={`${styles.header} glass-card`}>
          <h1 className={styles.title}>Nouveau pari</h1>
        </div>
        <EmptyState title="Aucune compétition en cours" subtitle="La prochaine arrive bientôt." />
      </div>
    );
  }

  return (
    <div className={`${styles.page} photo-page`}>
      <div className={`${styles.header} glass-card`}>
        <h1 className={styles.title}>Nouveau pari</h1>
      </div>
      <BetForm mode="CREATE" bootstrap={data.bootstrap} context={data.context} shortcutClosed={data.shortcutClosed} />
    </div>
  );
}
