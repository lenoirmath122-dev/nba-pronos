import { SubPageShell } from "@/components/ui/SubPageShell";
import { PasswordSection } from "@/components/profile/PasswordSection";
import styles from "@/components/profile/profileShared.module.css";

export default function CredentialsPage() {
  return (
    <SubPageShell title="Identifiants">
      <section className={`${styles.section} glass-card`}>
        <PasswordSection />
      </section>
    </SubPageShell>
  );
}
