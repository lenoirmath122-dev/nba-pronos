import { redirect } from "next/navigation";
import { getProfileData } from "@/lib/queries/profile";
import { SubPageShell } from "@/components/ui/SubPageShell";
import { DangerSection } from "@/components/profile/DangerSection";

export default async function DangerPage({ searchParams }: { searchParams: Promise<{ profileError?: string }> }) {
  const sp = await searchParams;
  const profile = await getProfileData();
  if (!profile) redirect("/login");

  return (
    <SubPageShell title="Zone de danger" tone="danger">
      <DangerSection pseudo={profile.pseudo} error={sp.profileError} />
    </SubPageShell>
  );
}
