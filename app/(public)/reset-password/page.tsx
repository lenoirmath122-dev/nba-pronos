import Image from "next/image";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import styles from "@/components/auth/AuthScreen.module.css";

import { TAGLINE, pageMetadata } from "@/lib/seo";

// T6a §3 (arbre app/) : "reset Supabase standard (T2 §8)" — voir
// ResetPasswordForm pour le détail du mécanisme (une seule route, 2 modes).
// Pas de <h1> statique ici (contrairement à Login/Signup) : ResetPasswordForm
// a 3 états visuels distincts, chacun avec son propre titre ou aucun (état
// "Vérifie ta boîte mail", sans carte) — le titre appartient au composant.
export const metadata = pageMetadata({ title: "Nouveau mot de passe", path: "/reset-password", noindex: true });

export default function ResetPasswordPage() {
  return (
    <main className={`${styles.page} photo-page force-photo`}>
      <div className={styles.brand}>
        <Image src="/brand/logo-horizontal.svg" alt="Panier Ballon" width={256} height={48} unoptimized className={styles.brandLogo} />
        <p className={styles.brandTagline}>{TAGLINE}</p>
      </div>
      <ResetPasswordForm />
    </main>
  );
}
