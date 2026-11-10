import { StatsImportButton } from "@/components/admin/StatsImportButton";
import styles from "@/components/admin/AdminHub.module.css";

// Déclenche l'import des box scores (workflow GitHub run-stats-import-vm).

export default function AdminStatsImportPage() {
  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Import des box scores</h2>
      <p>
        Lance l&apos;import sur la VM, en plus du passage automatique de 12h et 16h (Paris). Le lancement se fait
        depuis GitHub : le détail du run est visible dans l&apos;onglet Actions.
      </p>
      <StatsImportButton />
    </div>
  );
}
