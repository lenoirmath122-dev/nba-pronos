import { AdminLinkList } from "@/components/admin/AdminLinkList";
import { ADMIN_SECTION_SCREENS, screenLabel } from "@/lib/admin/navigation";
import styles from "@/components/admin/AdminHub.module.css";

// Rubrique « Système » : liste des écrans déclarés dans lib/admin/navigation.ts.

export default function AdminSystemPage() {
  const entries = ADMIN_SECTION_SCREENS.system.map((href) => ({ href, label: screenLabel(href) }));

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Système</h2>
      <AdminLinkList entries={entries} />
    </div>
  );
}
