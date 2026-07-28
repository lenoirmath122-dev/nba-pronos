import Link from "next/link";
import styles from "./PlayHubCard.module.css";

// Carte de SPEC_ECRAN_HUB_JOUER_V0_1 §2/§3. Composant serveur pur (aucune
// interaction hormis la navigation native <Link>). État vide (§3, acté avec
// l'utilisateur) : ni badge ni lignes → carte réduite au titre seul, JAMAIS
// de libellé de substitution du type « Rien à faire ».

export type PlayHubCardProps = {
  title: string;
  href: string;
  badge?: number; // omis si 0/undefined
  lines?: string[]; // 0-2 lignes d'aperçu, très courtes
};

export function PlayHubCard({ title, href, badge, lines }: PlayHubCardProps) {
  return (
    <Link href={href} className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        {badge !== undefined && badge > 0 && <span className={styles.badge}>{badge}</span>}
      </div>
      {lines && lines.length > 0 && (
        <div className={styles.lines}>
          {lines.map((line, i) => (
            <p key={i} className={styles.line}>
              {line}
            </p>
          ))}
        </div>
      )}
    </Link>
  );
}
