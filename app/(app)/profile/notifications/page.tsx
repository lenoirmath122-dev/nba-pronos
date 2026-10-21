import { redirect } from "next/navigation";
import { getProfileData } from "@/lib/queries/profile";
import { SubPageShell } from "@/components/ui/SubPageShell";
import { NotificationSettings } from "@/components/profile/NotificationSettings";
import styles from "@/components/profile/profileShared.module.css";

export default async function NotificationsPage() {
  const profile = await getProfileData();
  if (!profile) redirect("/login");

  return (
    <SubPageShell title="Notifications">
      <section className={`${styles.section} glass-card`}>
        <NotificationSettings
          initialPreference={profile.notificationPreference}
          initialRecapEnabled={profile.recapEnabled}
          initialPopupMentionsOptOut={profile.popupMentionsOptOut}
          initialEmailResults={profile.emailResultsEnabled}
          initialEmailReminders={profile.emailRemindersEnabled}
        />
      </section>
    </SubPageShell>
  );
}
