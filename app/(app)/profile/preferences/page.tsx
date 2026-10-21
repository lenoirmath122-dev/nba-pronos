import { redirect } from "next/navigation";
import { getProfileData, getTeamOptions } from "@/lib/queries/profile";
import { SubPageShell } from "@/components/ui/SubPageShell";
import { PreferencesSection } from "@/components/profile/PreferencesSection";

export default async function PreferencesPage({ searchParams }: { searchParams: Promise<{ profileError?: string }> }) {
  const sp = await searchParams;
  const profile = await getProfileData();
  if (!profile) redirect("/login");
  const teams = await getTeamOptions();

  return (
    <SubPageShell title="Préférences">
      <PreferencesSection
        teams={teams}
        favoriteTeamId={profile.favoriteTeamId}
        bio={profile.bio}
        error={sp.profileError}
      />
    </SubPageShell>
  );
}
