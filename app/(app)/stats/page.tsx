import { redirect } from "next/navigation";

// Ancienne page Stats, absorbée par « Mon profil » (Lot 3a) : ses 6 onglets
// deviennent l'onglet Stats (5 sections, `?section=`) et l'onglet Badges.
export default async function StatsPage({ searchParams }: { searchParams: Promise<{ tab?: string; ligue?: string }> }) {
  const { tab, ligue } = await searchParams;
  if (tab === "badges") redirect("/profile?tab=badges");
  const params = new URLSearchParams({ tab: "stats" });
  if (tab) params.set("section", tab);
  if (ligue) params.set("ligue", ligue);
  redirect(`/profile?${params.toString()}`);
}
