import styles from "./ProgressBar.module.css";

// Progression X/15 (Playoffs) ou X/7 (NBA Cup) — §10.1/§14. Nombre de séries
// dont le résultat réel est connu, calculé par lib/queries/bracket.ts.
// `label` optionnel (04/08/2026, onglet Stats du Profil) : le libellé
// d'accessibilité par défaut ("Progression : X sur Y") ne convient pas à
// tous les usages (ex. précision de pronos) — surchageable sans changer le
// comportement des appelants existants.
type ProgressBarProps = {
  filledCount: number;
  totalCount: number;
  label?: string;
};

export function ProgressBar({ filledCount, totalCount, label }: ProgressBarProps) {
  const percentage = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

  return (
    <div className={styles.wrapper} aria-label={label ?? `Progression : ${filledCount} sur ${totalCount}`}>
      <span className={styles.track}>
        <span className={styles.fill} style={{ width: `${percentage}%` }} />
      </span>
      <span className={styles.label}>
        {filledCount}/{totalCount}
      </span>
    </div>
  );
}
