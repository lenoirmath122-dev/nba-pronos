import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { getNavBadgeData } from "@/lib/queries/home";
import { getRecentAdminValidatedBets } from "@/lib/queries/bets";
import { TabBar } from "@/components/nav/TabBar";
import { GuestTabBar } from "@/components/nav/GuestTabBar";
import { GuestPhotoTheme } from "@/components/theme/GuestPhotoTheme";
import { AuthGateProvider } from "@/components/auth/AuthGateProvider";
import { UnsavedGuardProvider } from "@/lib/hooks/useUnsavedGuard";
import { ToastProvider } from "@/components/ui/Toast";
import { ValidatedDialogProvider } from "@/components/ui/ValidatedDialog";
import { ValidatedBetsWatcher } from "@/components/bets/ValidatedBetsWatcher";
import { NewBadgesWatcher } from "@/components/badges/NewBadgesWatcher";
import { OnboardingGuide } from "@/components/onboarding/OnboardingGuide";
import { WeeklyPopupProvider } from "@/components/weeklyPopup/WeeklyPopupProvider";
import { WeeklyPopupWatcher } from "@/components/weeklyPopup/WeeklyPopupWatcher";
import { ActivityRecapWatcher } from "@/components/recap/ActivityRecapWatcher";
import { ThemeSync } from "@/components/theme/ThemeSync";
import type { BackgroundTheme, ThemePreference } from "@/lib/theme/cookie";
import styles from "./layout.module.css";

// Zone joueur (T6a §3.1) : nav 5 onglets. Depuis le 18/11/2026 un INVITÉ
// (sans session) ouvre la même appli en lecture : coquille sans profil,
// pastilles ni popups, le compte n'étant demandé qu'au moment d'agir
// (AuthGateProvider). L'écriture reste refusée en base (RLS + auth.getUser()
// dans chaque Server Action). /home et /profile gardent leur propre garde
// (layouts dédiés) : le proxy les protège déjà en amont, ceci est la défense
// en profondeur côté composant serveur.
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className={styles.shell}>
        <GuestPhotoTheme />
        <AuthGateProvider authenticated={false}>
          <UnsavedGuardProvider>
            <ToastProvider>
              <ValidatedDialogProvider>
                <main className={styles.content}>{children}</main>
                <GuestTabBar />
              </ValidatedDialogProvider>
            </ToastProvider>
          </UnsavedGuardProvider>
        </AuthGateProvider>
      </div>
    );
  }

  // Compte en attente (arrivé par Google sans pseudo, ou lien pas encore cliqué) :
  // les règles de lecture ne le reconnaissent pas encore, on le renvoie finir
  // son inscription plutôt que d'afficher des écrans vides.
  const { data: profile } = await getServiceClient()
    .from("users")
    .select("status, age_confirmed_at, theme_preference, background_theme")
    .eq("id", user.id)
    .maybeSingle<{
      status: string;
      age_confirmed_at: string | null;
      theme_preference: ThemePreference;
      background_theme: BackgroundTheme;
    }>();
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
      <AuthGateProvider authenticated>
      <UnsavedGuardProvider>
        <ToastProvider>
          <ValidatedDialogProvider>
            <main className={styles.content}>{children}</main>
            <TabBar navBadges={navBadges} />
            {/* Thème lu ici (même requête que le statut) depuis que le layout
                racine ne lit plus la session -- voir lib/theme/cookie.ts. */}
            <ThemeSync
              theme={profile?.theme_preference ?? "DARK"}
              background={profile?.background_theme ?? "MURAL"}
            />
            <ValidatedBetsWatcher bets={adminValidatedBets} />
            {/* Ordre des popups : « Pari validé », popup hebdo (lot 5), puis
                badges. Chaque watcher charge ses données lui-même après
                l'affichage, pour ne pas ralentir la coquille. */}
            <WeeklyPopupProvider>
              <WeeklyPopupWatcher />
              {/* Récap des résultats tombés depuis la dernière visite. */}
              <ActivityRecapWatcher />
              {/* Popup « nouveau badge » (p3-9). */}
              <NewBadgesWatcher />
            {/* Guide d'arrivée : notifications + raccourci écran d'accueil. */}
            <OnboardingGuide />
            </WeeklyPopupProvider>
          </ValidatedDialogProvider>
        </ToastProvider>
      </UnsavedGuardProvider>
      </AuthGateProvider>
    </div>
  );
}
