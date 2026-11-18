import { PublicNav } from "./PublicNav";
import styles from "./ScreenShell.module.css";

// Coque des pages réservées aux invités (mode invité). Même rendu que
// ScreenShell quand `authenticated` est faux, mais sans importer TabBar : ce
// module tire le client Supabase et le tiroir de réglages (~300 Ko de JS) que
// les pages invité préchargeaient sans jamais les afficher (mesuré, lot G).
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <PublicNav />
      <main className={styles.contentPublic}>{children}</main>
    </div>
  );
}
