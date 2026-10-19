import Image from "next/image";
import { redirect } from "next/navigation";
import { WelcomePanel } from "@/components/publicHome/WelcomePanel";
import styles from "@/components/auth/AuthScreen.module.css";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Bienvenue", path: "/bienvenue", noindex: true });

type MatchTeams = { id: string; home: { id: string; name: string } | null; away: { id: string; name: string } | null };

export default async function WelcomePage() {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Lecture du seul compte connecté, avec le client serveur privilégié : le profil
  // d'un compte tout juste validé ne doit pas dépendre d'une règle de lecture.
  const service = getServiceClient();
  const { data: profile } = await service
    .from("users")
    .select("pseudo, status, age_confirmed_at, email_results_enabled, email_reminders_enabled")
    .eq("id", user.id)
    .maybeSingle<{
      pseudo: string;
      status: string;
      age_confirmed_at: string | null;
      email_results_enabled: boolean;
      email_reminders_enabled: boolean;
    }>();
  if (!profile) redirect("/login");
  if (profile.status === "PENDING") redirect(profile.age_confirmed_at === null ? "/choisir-pseudo" : "/login");

  const { data: rows } = await service
    .from("match_predictions")
    .select("match_id, predicted_margin, predicted_winner_team_id")
    .eq("user_id", user.id)
    .eq("status", "VALIDATED")
    .order("created_at", { ascending: false })
    .limit(10);
  const { data: matches } = await service
    .from("matches")
    .select(
      "id, home:teams!matches_home_team_id_fkey(id, name), away:teams!matches_away_team_id_fkey(id, name)",
    )
    .in("id", (rows ?? []).map((r) => r.match_id as string))
    .returns<MatchTeams[]>();
  const matchById = new Map((matches ?? []).map((m) => [m.id, m]));

  const pronos = (rows ?? []).flatMap((r) => {
    const m = matchById.get(r.match_id as string);
    const winner = [m?.home, m?.away].find((t) => t?.id === r.predicted_winner_team_id);
    return winner ? [`${winner.name} +${r.predicted_margin}`] : [];
  });

  return (
    <main className={`${styles.page} photo-page force-photo`}>
      <div className={styles.brand}>
        <Image src="/brand/logo-horizontal.svg" alt="Panier Ballon" width={256} height={48} unoptimized className={styles.brandLogo} />
      </div>
      <WelcomePanel
        pseudo={profile.pseudo}
        pronos={pronos}
        initialResults={profile.email_results_enabled}
        initialReminders={profile.email_reminders_enabled}
      />
    </main>
  );
}
