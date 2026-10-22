import { AdminLinkList } from "@/components/admin/AdminLinkList";
import { ADMIN_SECTION_SCREENS, screenLabel } from "@/lib/admin/navigation";
import styles from "@/components/admin/AdminHub.module.css";

// Rubrique « Jeu » : liste des écrans déclarés dans lib/admin/navigation.ts.

export default function AdminGamePage() {
  const entries = ADMIN_SECTION_SCREENS.game.map((href) => ({ href, label: screenLabel(href) }));

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Jeu</h2>
      <AdminLinkList entries={entries} />
    </div>
  );
}
