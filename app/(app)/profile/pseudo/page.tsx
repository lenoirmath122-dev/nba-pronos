import { redirect } from "next/navigation";
import { getProfileData } from "@/lib/queries/profile";
import { getMyLatestPseudoRequest } from "@/lib/queries/pseudo-requests";
import { SubPageShell } from "@/components/ui/SubPageShell";
import { PseudoSection } from "@/components/profile/PseudoSection";

export default async function PseudoPage({
  searchParams,
}: {
  searchParams: Promise<{ pseudoError?: string; pseudoSent?: string }>;
}) {
  const sp = await searchParams;
  const profile = await getProfileData();
  if (!profile) redirect("/login");
  const request = await getMyLatestPseudoRequest(profile.userId);

  return (
    <SubPageShell title="Pseudo">
      <PseudoSection pseudo={profile.pseudo} request={request} error={sp.pseudoError} sent={Boolean(sp.pseudoSent)} />
    </SubPageShell>
  );
}
