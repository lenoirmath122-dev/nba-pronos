import Link from "next/link";
import { getBracketFillData } from "@/lib/queries/bracket-fill";
import { getRemainingSeriesBets } from "@/lib/queries/series-bets";
import styles from "./BracketEntry.module.css";

// Point d'entrée permanent vers le Bracket (décision 2, §4
// SPEC_REFONTE_ONGLET_JOUER_V0_1) — remplace la carte "Mon bracket" de
// l'ancien hub, visible dans l'en-tête des DEUX onglets. Réutilise
// getBracketFillData()/getRemainingSeriesBets() SANS recalcul (même
// réutilisation que lib/queries/play-hub.ts, qui documente déjà pourquoi ne
// pas les redupliquer). Composant serveur, aucune interaction hormis la
// navigation native du lien.

const NEAR_DEADLINE_MS = 2 * 24 * 60 * 60 * 1000; // même seuil que l'ex-hub (§2.3 SPEC_ECRAN_HUB_JOUER)

function deadlineLabel(deadline: string): string {
  const remainingMs = Date.parse(deadline) - Date.now();
  const hours = Math.max(0, Math.round(remainingMs / (60 * 60 * 1000)));
  if (hours < 24) return `${hours} h`;
  return `${Math.round(hours / 24)} j`;
}

// Extrait en fonction nommée plutôt qu'inline dans le composant : la règle
// react-hooks/purity interdit un appel direct à Date.now()/Date.parse() dans
// le corps d'un composant (même serveur) — même patron déjà utilisé par
// deadlineLabel ci-dessus et par l'ex-hub Jouer.
function computeIsNearDeadline(isActionable: boolean, deadline: string | null): boolean {
  return isActionable && deadline !== null && Date.parse(deadline) - Date.now() < NEAR_DEADLINE_MS;
}

export async function BracketEntry() {
  const [data, remainingSeriesBets] = await Promise.all([getBracketFillData(), getRemainingSeriesBets()]);

  if (data.competitionId === null) return null;

  const isActionable = data.isStructureKnown && !data.isDeadlinePassed;
  const isNearDeadline = computeIsNearDeadline(isActionable, data.deadline);

  const lines: string[] = [];
  if (isActionable) {
    lines.push(`${data.filledCount}/${data.totalCount}`);
    if (isNearDeadline && data.deadline) lines.push(deadlineLabel(data.deadline));
  }
  if (remainingSeriesBets.length > 0) {
    lines.push(`${remainingSeriesBets.length} pari${remainingSeriesBets.length > 1 ? "s" : ""} série`);
  }

  return (
    <Link href="/play/bracket" className={styles.entry}>
      <span className={styles.label}>Bracket</span>
      {lines.length > 0 && <span className={styles.meta}>{lines.join(" · ")}</span>}
      <span className={styles.chevron} aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
