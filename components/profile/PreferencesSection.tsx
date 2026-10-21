import { updateProfile } from "@/lib/actions/profile";
import type { TeamOption } from "@/lib/queries/profile";
import { TeamPicker } from "@/components/profile/TeamPicker";
import styles from "./profileShared.module.css";

type PreferencesSectionProps = {
  teams: TeamOption[];
  favoriteTeamId: string | null;
  bio: string;
  error?: string;
};

export function PreferencesSection({ teams, favoriteTeamId, bio, error }: PreferencesSectionProps) {
  return (
    <section className={`${styles.section} glass-card`}>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <form action={updateProfile} className={styles.preferencesForm}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Équipe favorite</span>
          <TeamPicker teams={teams} selectedTeamId={favoriteTeamId} />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Bio</span>
          <textarea
            name="bio"
            defaultValue={bio}
            placeholder="Quelques mots sur toi (facultatif)"
            rows={3}
            maxLength={2000}
            className={styles.textarea}
          />
        </label>

        <button type="submit" className={styles.primaryButton}>
          Enregistrer
        </button>
      </form>
    </section>
  );
}
