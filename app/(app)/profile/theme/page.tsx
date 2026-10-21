import { redirect } from "next/navigation";
import { getProfileData } from "@/lib/queries/profile";
import { SubPageShell } from "@/components/ui/SubPageShell";
import { ThemeSection } from "@/components/profile/ThemeSection";

export default async function ThemePage({ searchParams }: { searchParams: Promise<{ profileError?: string }> }) {
  const sp = await searchParams;
  const profile = await getProfileData();
  if (!profile) redirect("/login");

  return (
    <SubPageShell title="Thème">
      <ThemeSection theme={profile.theme} backgroundTheme={profile.backgroundTheme} error={sp.profileError} />
    </SubPageShell>
  );
}
