import Link from "next/link";
import type { FeedItem } from "@/lib/queries/home";
import { WinIcon, LossIcon, NeutralIcon } from "@/components/icons/home-icons";
import styles from "./FeedRow.module.css";

type FeedRowProps = {
  item: FeedItem;
};

const OUTCOME_STYLE: Record<FeedItem["outcome"], string> = {
  win: styles.win,
  loss: styles.loss,
  neutral: styles.neutral,
};

// Icône de résultat (§6, polish visuel) : le résultat se lit sans chercher la
// couleur du chiffre de points. Vert/rouge STRICTEMENT réservés au résultat
// gagné/perdu (R-COL) — même règle que la couleur du texte déjà en place.
const OUTCOME_ICON: Record<FeedItem["outcome"], typeof WinIcon> = {
  win: WinIcon,
  loss: LossIcon,
  neutral: NeutralIcon,
};
const OUTCOME_ICON_CLASS: Record<FeedItem["outcome"], string> = {
  win: styles.iconWin,
  loss: styles.iconLoss,
  neutral: styles.iconNeutral,
};

export function FeedRow({ item }: FeedRowProps) {
  // Seul le pari statué "neutralisé" (bet_resolved) est barré/grisé — jamais
  // un résultat gagné/perdu, qui reste un rendu de jeu normal (T6c §4).
  const cancelled = item.kind === "bet_resolved";
  const Icon = OUTCOME_ICON[item.outcome];
  const rowClassName = cancelled ? styles.rowCancelled : styles.row;

  const content = (
    <>
      <span className={`${styles.icon} ${OUTCOME_ICON_CLASS[item.outcome]}`} aria-hidden="true">
        <Icon size={14} />
      </span>
      <div className={styles.text}>
        <p className={styles.label}>{item.label}</p>
        {item.detail && <p className={styles.detail}>{item.detail}</p>}
      </div>
      <span className={`${styles.points} ${OUTCOME_STYLE[item.outcome]}`}>
        {formatPoints(item.points)}
      </span>
    </>
  );

  // Mène vers l'item d'origine (18/08/2026, demandé par l'utilisateur) —
  // `href` reste `null` seulement dans un cas défensif (cible introuvable,
  // ne devrait pas arriver en pratique) : repli sans lien plutôt qu'un lien
  // mort.
  return (
    <li>
      {item.href ? (
        <Link href={item.href} className={rowClassName}>
          {content}
        </Link>
      ) : (
        <div className={rowClassName}>{content}</div>
      )}
    </li>
  );
}

// Pivot A1 : null = rien joué ("-"), 0 = scoré-zéro ("0").
function formatPoints(points: number | null): string {
  if (points === null) return "-";
  return `${points} pt${points > 1 ? "s" : ""}`;
}
