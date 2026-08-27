import Image from "next/image";
import { LoginForm } from "@/components/auth/LoginForm";
import styles from "@/components/auth/AuthScreen.module.css";

export default function LoginPage() {
  return (
    <main className={`${styles.page} photo-page force-photo`}>
      <div className={styles.brand}>
        <Image src="/brand/logo.svg" alt="" width={73} height={80} unoptimized className={styles.brandLogo} />
        <p className={styles.brandName}>Panier Ballon</p>
        <p className={styles.brandTagline}>Pronostics et paris entre amis sur les playoffs NBA.</p>
      </div>
      <LoginForm />
    </main>
  );
}
