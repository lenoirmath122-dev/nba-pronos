import Image from "next/image";
import { LoginForm } from "@/components/auth/LoginForm";
import { WipDisclaimer } from "@/components/ui/WipDisclaimer";
import styles from "@/components/auth/AuthScreen.module.css";

import { TAGLINE, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Connexion", path: "/login" });

export default function LoginPage() {
  return (
    <main className={`${styles.page} photo-page force-photo`}>
      <div className={styles.brand}>
        <Image src="/brand/logo.svg" alt="" width={73} height={80} unoptimized className={styles.brandLogo} />
        <p className={styles.brandName}>Panier Ballon</p>
        <p className={styles.brandTagline}>{TAGLINE}</p>
      </div>
      <WipDisclaimer />
      <LoginForm />
    </main>
  );
}
