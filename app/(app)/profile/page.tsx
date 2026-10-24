import { redirect } from "next/navigation";
import { PROFILE_MENU_URL } from "@/lib/nav/profileMenu";
import { LegacyAccountRedirect } from "@/components/profile/LegacyAccountRedirect";
import { getServerClient } from "@/lib/supabase/server";
import { getProfileData } from "@/lib/queries/profile";
import { getProfileBadges, getRowShowcases } from "@/lib/queries/badges";
import { getCompetitionHistory } from "@/lib/queries/history";
import { getMyLeagues } from "@/lib/queries/leagues";
import { getProfileMenuSummary } from "@/lib/actions/profileMenu";
import { SubPageShell } from "@/components/ui/SubPageShell";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileTabsNav, parseProfileTab } from "@/components/profile/ProfileTabsNav";
import { StatsPanel, parseStatsSection } from "@/components/profile/StatsPanel";
import { BadgesTab } from "@/components/badges/BadgesTab";
import { HistorySection } from "@/components/profile/HistorySection";
import { LeaguesSection } from "@/components/profile/LeaguesSection";
import profileStyles from "@/components/profile/profileShared.module.css";

// « Mon profil » (Lot 3a du chantier Profil & badges) : en-tête commun puis 4
// onglets Stats · Badges · Historique · Ligues, `?tab=`. Remplace /stats,
// /profile/historique et /profile/ligues, qui redirigent ici. Les anciennes
// URLs `?tab=compte` / `?tab=admin` gardent leur redirection.
type ProfileSearchParams = {
  tab?: string;
  section?: string;
  ligue?: string;
  profileError?: string;
  leagueError?: string;
  leagueJoined?: string;
  newLeagueName?: string;
  newLeagueCode?: string;
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<ProfileSearchParams> }) {
  const sp = await searchParams;
  if (sp.tab === "admin") redirect("/admin");
  // ?tab=compte#settings-xxx : le hash n'arrive pas au serveur, redirection côté client.
  if (sp.tab === "compte") return <LegacyAccountRedirect />;

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getProfileData();
  if (!profile) redirect(PROFILE_MENU_URL);

  const tab = parseProfileTab(sp.tab);

  // En-tête : rang, meilleur rang et nombre de badges comme dans le panneau.
  const [summary, showcases] = await Promise.all([
    getProfileMenuSummary().catch(() => null),
    getRowShowcases([user.id], 3).catch(() => new Map()),
  ]);
  const chips = [
    ...(summary?.rank != null ? [{ label: `#${summary.rank} · ${summary.points ?? 0} pts`, accent: true }] : []),
    ...(summary?.badgeCount != null && summary.badgeTotal != null
      ? [{ label: `${summary.badgeCount}/${summary.badgeTotal} badges` }]
      : []),
    ...(summary?.bestRank != null ? [{ label: `Meilleur rang #${summary.bestRank}` }] : []),
  ];

  // Une seule lecture par onglet affiché.
  const badges = tab === "badges" ? await getProfileBadges() : null;
  const history = tab === "historique" ? await getCompetitionHistory() : null;
  const leagues = tab === "ligues" ? await getMyLeagues() : null;

  return (
    <SubPageShell title="Mon profil">
      <ProfileHeader
        userId={user.id}
        pseudo={profile.pseudo}
        favoriteTeam={profile.favoriteTeam}
        isAdmin={profile.isAdmin}
        bio={profile.bio}
        showcase={showcases.get(user.id) ?? []}
        chips={chips}
        editHref="/profile/preferences"
        badgesHref="/profile?tab=badges"
      />
      <ProfileTabsNav active={tab} />

      {sp.profileError && (
        <p className={profileStyles.error} role="alert">
          {sp.profileError}
        </p>
      )}

      {tab === "stats" && <StatsPanel userId={user.id} section={parseStatsSection(sp.section)} ligue={sp.ligue} />}
      {badges && (
        <section className={`${profileStyles.section} glass-card`} aria-label="Badges">
          <BadgesTab data={badges} />
        </section>
      )}
      {history && <HistorySection history={history} />}
      {leagues && (
        <LeaguesSection
          leagues={leagues}
          error={sp.leagueError}
          joinedName={sp.leagueJoined}
          newLeagueName={sp.newLeagueName}
          newLeagueCode={sp.newLeagueCode}
        />
      )}
    </SubPageShell>
  );
}
