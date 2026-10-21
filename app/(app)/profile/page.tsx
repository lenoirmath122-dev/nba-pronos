import { redirect } from "next/navigation";
import { PROFILE_MENU_URL } from "@/lib/nav/profileMenu";
import { LegacyAccountRedirect } from "@/components/profile/LegacyAccountRedirect";

// Ancien écran Profil (accordéons) supprimé : chaque entrée du menu a sa page
// dédiée (/profile/<section>). Cette route ne sert plus qu'à rediriger les
// anciennes URLs (favoris, notifications push, mails).
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  if (tab === "stats") redirect("/stats");
  if (tab === "historique") redirect("/profile/historique");
  if (tab === "ligues") redirect("/profile/ligues");
  if (tab === "admin") redirect("/admin");
  // ?tab=compte#settings-xxx : le hash n'arrive pas au serveur, redirection côté client.
  if (tab === "compte") return <LegacyAccountRedirect />;
  redirect(PROFILE_MENU_URL);
}
