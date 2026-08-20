import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import styles from "@/components/auth/AuthScreen.module.css";

// T6a §3 (arbre app/) : "reset Supabase standard (T2 §8)" — voir
// ResetPasswordForm pour le détail du mécanisme (une seule route, 2 modes).
// Pas de <h1> statique ici (contrairement à Login/Signup) : ResetPasswordForm
// a 3 états visuels distincts, chacun avec son propre titre ou aucun (état
// "Vérifie ta boîte mail", sans carte) — le titre appartient au composant.
export default function ResetPasswordPage() {
  return (
    <main className={`${styles.page} photo-page force-photo`}>
      <div className={styles.brand}>
        <p className={styles.brandName}>NBA Pronos</p>
        <p className={styles.brandTagline}>Pronostics et paris entre amis sur les playoffs NBA.</p>
      </div>
      <ResetPasswordForm />
    </main>
  );
}
