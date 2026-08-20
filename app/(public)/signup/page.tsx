import { SignupForm } from "@/components/auth/SignupForm";
import styles from "@/components/auth/AuthScreen.module.css";

export default function SignupPage() {
  return (
    <main className={`${styles.page} photo-page`}>
      <div className={styles.brand}>
        <p className={styles.brandName}>NBA Pronos</p>
        <p className={styles.brandTagline}>Pronostics et paris entre amis sur les playoffs NBA.</p>
      </div>
      <SignupForm />
    </main>
  );
}
