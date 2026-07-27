import type { QuotaSummary } from "@/lib/queries/my-bets";
import { MATCH_SLOT_CAP } from "@/lib/labels/bets";
import styles from "./QuotaBanner.module.css";

// Résumé de quota (SPEC_ECRAN_MES_PARIS_V0_1 §4/§14.D) : bandeau global
// unique, pas dépliable par série/match — décision actée. AUCUN calcul de
// quota ici, seulement son affichage (la garde réelle reste dans save_bet,
// migration #10) ; MATCH_SLOT_CAP réutilisé tel quel, pas réinventé.

export function QuotaBanner({ quotas }: { quotas: QuotaSummary[] }) {
  if (quotas.length === 0) return null;

  return (
    <div className={styles.banner}>
      {quotas.map((q) =>
        q.kind === "PLAYOFFS" ? (
          <p key={q.seriesId} className={styles.line}>
            <span className={styles.label}>{q.seriesLabel}</span>
            <span>
              {q.seriesSlotUsed ? "1/1" : "0/1"} série · {q.matchSlotsUsed}/{MATCH_SLOT_CAP} match
            </span>
          </p>
        ) : (
          <p key={q.matchId} className={styles.line}>
            <span className={styles.label}>{q.matchLabel}</span>
            <span>{q.matchSlotUsed ? "1/1" : "0/1"}</span>
          </p>
        )
      )}
    </div>
  );
}
