import { LoginForm } from "@/components/auth/LoginForm";
import styles from "@/components/auth/AuthScreen.module.css";

export default function LoginPage() {
  return (
    <main className={`${styles.page} photo-page`}>
      <div className={styles.brand}>
        <p className={styles.brandName}>NBA Pronos</p>
        <p className={styles.brandTagline}>Pronostics et paris entre amis sur les playoffs NBA.</p>
      </div>
      <LoginForm />
    </main>
  );
}
