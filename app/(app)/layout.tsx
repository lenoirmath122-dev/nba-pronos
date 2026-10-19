import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { getNavBadgeData } from "@/lib/queries/home";
import { getRecentAdminValidatedBets } from "@/lib/queries/bets";
import { TabBar } from "@/components/nav/TabBar";
import { BugReportButton } from "@/components/feedback/BugReportButton";
import { UnsavedGuardProvider } from "@/lib/hooks/useUnsavedGuard";
import { ToastProvider } from "@/components/ui/Toast";
import { ValidatedDialogProvider } from "@/components/ui/ValidatedDialog";
import { ValidatedBetsWatcher } from "@/components/bets/ValidatedBetsWatcher";
import { NewBadgesWatcher } from "@/components/badges/NewBadgesWatcher";
import { OnboardingGuide } from "@/components/onboarding/OnboardingGuide";
import { WeeklyPopupProvider } from "@/components/weeklyPopup/WeeklyPopupProvider";
import { WeeklyPopupWatcher } from "@/components/weeklyPopup/WeeklyPopupWatcher";
import styles from "./layout.module.css";

// Zone joueur connecté (T6a §3.1) : garde de session + nav 4 onglets.
// Le proxy (racine du repo) garde déjà l'authentification en amont ; cette
// garde est la défense en profondeur côté composant serveur (même patron
// que la garde is_admin() du layout admin, T6a §4.2).
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Compte en attente (arrivé par Google sans pseudo, ou lien pas encore cliqué) :
  // les règles de lecture ne le reconnaissent pas encore, on le renvoie finir
  // son inscription plutôt que d'afficher des écrans vides.
  const { data: profile } = await getServiceClient()
    .from("users")
    .select("status, age_confirmed_at")
    .eq("id", user.id)
    .maybeSingle<{ status: string; age_confirmed_at: string | null }>();
  if (profile?.status === "PENDING") {
    redirect(profile.age_confirmed_at === null ? "/choisir-pseudo" : "/login");
  }

  // Pastilles TabBar (18/09/2026, demandé par l'utilisateur) : lues UNE FOIS
  // à l'entrée dans la zone (app), pas à chaque navigation cliente (les
  // layouts partagés ne sont pas refetch sur une navigation entre pages
  // sœurs) — rafraîchies au rechargement complet et après toute action
  // serveur qui revalide "/home" ou "/play" (déjà le cas des mutations de
  // paris/pronos/bracket).
  // Même lecture unique pour les paris validés par un admin depuis la
  // dernière visite (popup « Pari validé », ValidatedBetsWatcher).
  const [navBadges, adminValidatedBets] = await Promise.all([getNavBadgeData(), getRecentAdminValidatedBets()]);

  return (
    <div className={styles.shell}>
      <UnsavedGuardProvider>
        <ToastProvider>
          <ValidatedDialogProvider>
            <main className={styles.content}>{children}</main>
            <BugReportButton />
            <TabBar navBadges={navBadges} />
            <ValidatedBetsWatcher bets={adminValidatedBets} />
            {/* Ordre des popups : « Pari validé », popup hebdo (lot 5), puis
                badges. Chaque watcher charge ses données lui-même après
                l'affichage, pour ne pas ralentir la coquille. */}
            <WeeklyPopupProvider>
              <WeeklyPopupWatcher />
              {/* Popup « nouveau badge » (p3-9). */}
              <NewBadgesWatcher />
            {/* Guide d'arrivée : notifications + raccourci écran d'accueil. */}
            <OnboardingGuide />
            </WeeklyPopupProvider>
          </ValidatedDialogProvider>
        </ToastProvider>
      </UnsavedGuardProvider>
    </div>
  );
}
