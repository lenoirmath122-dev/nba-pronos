import Image from "next/image";
import { redirect } from "next/navigation";
import { ChoosePseudoForm } from "@/components/auth/ChoosePseudoForm";
import styles from "@/components/auth/AuthScreen.module.css";
import { getServerClient } from "@/lib/supabase/server";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Choisis ton pseudo", path: "/choisir-pseudo", noindex: true });

export default async function ChoosePseudoPage() {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className={`${styles.page} photo-page force-photo`}>
      <div className={styles.brand}>
        <Image src="/brand/logo-horizontal.svg" alt="Panier Ballon" width={256} height={48} unoptimized className={styles.brandLogo} />
      </div>
      <ChoosePseudoForm />
    </main>
  );
}
