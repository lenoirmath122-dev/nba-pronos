import Image from "next/image";
import { RegisterForm } from "@/components/publicHome/RegisterForm";
import styles from "@/components/auth/AuthScreen.module.css";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Enregistre tes pronos", path: "/enregistrer", noindex: true });

export default function RegisterPage() {
  return (
    <main className={`${styles.page} photo-page force-photo`}>
      <div className={styles.brand}>
        <Image src="/brand/logo-horizontal.svg" alt="Panier Ballon" width={256} height={48} unoptimized className={styles.brandLogo} />
      </div>
      <RegisterForm />
    </main>
  );
}
