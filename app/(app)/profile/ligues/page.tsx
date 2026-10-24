import { redirect } from "next/navigation";

// Absorbée par l'onglet Ligues de « Mon profil » (Lot 3a). Les paramètres de
// retour des actions (erreur, ligue rejointe...) sont conservés.
export default async function LeaguesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const params = new URLSearchParams({ tab: "ligues" });
  for (const [key, value] of Object.entries(sp)) if (value) params.set(key, value);
  redirect(`/profile?${params.toString()}`);
}
