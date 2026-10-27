import { RegisterForm } from "@/components/publicHome/RegisterForm";
import styles from "@/components/auth/AuthScreen.module.css";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Enregistre tes pronos", path: "/enregistrer", noindex: true });

export default function RegisterPage() {
  return (
    <main className={`${styles.page} ${styles.pageCompact} photo-page force-photo`}>
      <RegisterForm />
    </main>
  );
}
