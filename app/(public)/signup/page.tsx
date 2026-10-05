import Image from "next/image";
import { SignupForm } from "@/components/auth/SignupForm";
import { WipDisclaimer } from "@/components/ui/WipDisclaimer";
import styles from "@/components/auth/AuthScreen.module.css";

import { TAGLINE, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Inscription",
  path: "/signup",
  description: "Crée ton compte Panier Ballon et lance ta ligue de pronostics NBA entre amis.",
});

export default function SignupPage() {
  return (
    <main className={`${styles.page} photo-page force-photo`}>
      <div className={styles.brand}>
        <Image src="/brand/logo-horizontal.svg" alt="Panier Ballon" width={256} height={48} unoptimized className={styles.brandLogo} />
        <p className={styles.brandTagline}>{TAGLINE}</p>
      </div>
      <WipDisclaimer />
      <SignupForm />
    </main>
  );
}
