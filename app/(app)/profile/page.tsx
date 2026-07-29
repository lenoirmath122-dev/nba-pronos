import { redirect } from "next/navigation";
import Link from "next/link";
import { getProfileData, getTeamOptions } from "@/lib/queries/profile";
import { updateThemePreference, updateProfile } from "@/lib/actions/profile";
import { logout } from "@/lib/auth/actions";
import { TeamPicker } from "@/components/profile/TeamPicker";
import styles from "./page.module.css";

// Écran Profil (SPEC_ECRAN_PROFIL_V0_1, CLOSE) — 4ème onglet de la nav.
// Remplace le stub "à venir" (22/07/2026) et le bouton de déconnexion
// temporaire (app/(app)/layout.tsx, §5 de la spec).

type SearchParams = { profileError?: string };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const profile = await getProfileData();
  if (!profile) redirect("/login"); // ne devrait pas se produire : layout (app) garde déjà la session.

  const teams = await getTeamOptions();

  return (
    <div className={styles.page}>
      <header className={`${styles.header} hero-banner`}>
        <h1 className={`${styles.pseudo} hero-banner-title`}>{profile.pseudo}</h1>
        {profile.isAdmin && <span className={styles.adminBadge}>Admin</span>}
      </header>

      {sp.profileError && (
        <p className={styles.error} role="alert">
          {sp.profileError}
        </p>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Thème</h2>
        <form action={updateThemePreference}>
          <input type="hidden" name="theme" value={profile.theme === "DARK" ? "LIGHT" : "DARK"} />
          <button type="submit" className={styles.secondaryButton}>
            Passer en thème {profile.theme === "DARK" ? "clair" : "sombre"}
          </button>
        </form>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Préférences</h2>
        <form action={updateProfile} className={styles.preferencesForm}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Équipe favorite</span>
            <TeamPicker teams={teams} selectedTeamId={profile.favoriteTeamId} />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Bio</span>
            <textarea
              name="bio"
              defaultValue={profile.bio}
              placeholder="Quelques mots sur toi (facultatif)"
              rows={3}
              className={styles.textarea}
            />
          </label>

          <button type="submit" className={styles.primaryButton}>
            Enregistrer
          </button>
        </form>
      </section>

      {profile.isAdmin && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Administration</h2>
          <Link href="/admin" className={styles.adminLink}>
            Tableau de bord admin
          </Link>
        </section>
      )}

      <section className={styles.section}>
        <form action={logout}>
          <button type="submit" className={styles.logoutButton}>
            Déconnexion
          </button>
        </form>
      </section>
    </div>
  );
}
