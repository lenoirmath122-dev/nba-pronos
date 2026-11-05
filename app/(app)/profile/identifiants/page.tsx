import { redirect } from "next/navigation";
import { getProfileData } from "@/lib/queries/profile";
import { getMyLatestPseudoRequest } from "@/lib/queries/pseudo-requests";
import { SubPageShell } from "@/components/ui/SubPageShell";
import { PasswordSection } from "@/components/profile/PasswordSection";
import { PseudoSection } from "@/components/profile/PseudoSection";
import styles from "@/components/profile/profileShared.module.css";

// Le changement de pseudo vit ici depuis le Lot 3a (la carte d'identité du
// panneau mène à « Mon profil »). /profile/pseudo reste en place : les
// actions et les notifications push y renvoient.
export default async function CredentialsPage() {
  const profile = await getProfileData();
  if (!profile) redirect("/login");
  const request = await getMyLatestPseudoRequest(profile.userId);

  return (
    <SubPageShell title="Identifiants et pseudo">
      <PseudoSection pseudo={profile.pseudo} request={request} />
      <section className={`${styles.section} glass-card`}>
        <PasswordSection />
      </section>
    </SubPageShell>
  );
}
