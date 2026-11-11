import { redirect } from "next/navigation";
import Link from "next/link";
import { getProfileData, getTeamOptions } from "@/lib/queries/profile";
import { getMyLatestPseudoRequest } from "@/lib/queries/pseudo-requests";
import { removeAvatarAction, uploadAvatarAction } from "@/lib/actions/images";
import { getInitials } from "@/lib/player/initials";
import { SubPageShell } from "@/components/ui/SubPageShell";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { PseudoSection } from "@/components/profile/PseudoSection";
import { PreferencesSection } from "@/components/profile/PreferencesSection";
import styles from "@/components/profile/profileShared.module.css";

// Page ouverte par la roue crantée de « Mon profil » : photo, pseudo (demande
// validée par un admin), équipe favorite et bio au même endroit.
export default async function EditProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ profileError?: string; pseudoError?: string; pseudoSent?: string }>;
}) {
  const sp = await searchParams;
  const profile = await getProfileData();
  if (!profile) redirect("/login");
  const [teams, request] = await Promise.all([getTeamOptions(), getMyLatestPseudoRequest(profile.userId)]);

  return (
    <SubPageShell title="Modifier le profil">
      <section className={`${styles.section} glass-card`}>
        <ImageUploader
          currentUrl={profile.avatarUrl}
          fallback={getInitials(profile.pseudo)}
          shape="round"
          label="Changer la photo"
          maxSide={256}
          upload={uploadAvatarAction}
          remove={removeAvatarAction}
        />
      </section>
      <PseudoSection pseudo={profile.pseudo} request={request} error={sp.pseudoError} sent={sp.pseudoSent === "1"} />
      <PreferencesSection teams={teams} favoriteTeamId={profile.favoriteTeamId} bio={profile.bio} error={sp.profileError} />
      <p className={styles.hint}>
        Mot de passe, notifications, thème : <Link href="/profile/identifiants">Identifiants</Link>.
      </p>
    </SubPageShell>
  );
}
