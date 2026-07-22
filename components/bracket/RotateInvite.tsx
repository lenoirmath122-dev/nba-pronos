import styles from "./RotateInvite.module.css";

// Invitation à tourner le téléphone (§10.3). SANS "use client" : aucun état
// propre, rendu exclusivement par TreeView (client) qui lui fournit ses
// callbacks — même mécanisme que NodeCard (§3).
type RotateInviteProps = {
  onDismiss: () => void;
  onSeeAnyway: () => void;
};

export function RotateInvite({ onDismiss, onSeeAnyway }: RotateInviteProps) {
  return (
    <div className={styles.overlay} role="dialog" aria-label="Tourne ton téléphone">
      <button type="button" className={styles.close} onClick={onDismiss} aria-label="Fermer">
        ×
      </button>

      <div className={styles.iconWrap}>
        <svg
          className={styles.icon}
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <rect x="7" y="2.5" width="10" height="19" rx="1.5" />
          <path d="M11 18.2h2" />
        </svg>
      </div>

      <p className={styles.title}>Tourne ton téléphone</p>
      <p className={styles.subtitle}>L&apos;arbre complet s&apos;affiche mieux en paysage.</p>

      <button type="button" className={styles.seeAnyway} onClick={onSeeAnyway}>
        Voir quand même
      </button>
    </div>
  );
}
