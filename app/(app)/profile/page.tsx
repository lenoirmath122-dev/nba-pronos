import { redirect } from "next/navigation";
import Link from "next/link";
import { getProfileData, getTeamOptions } from "@/lib/queries/profile";
import { getMyLeagues } from "@/lib/queries/leagues";
import { getCompetitionHistory } from "@/lib/queries/history";
import { updateThemePreference, updateProfile } from "@/lib/actions/profile";
import { createLeagueFormAction, joinLeagueFormAction, leaveLeagueFormAction } from "@/lib/actions/leagues";
import { logout } from "@/lib/auth/actions";
import { TeamPicker } from "@/components/profile/TeamPicker";
import { NotificationSettings } from "@/components/profile/NotificationSettings";
import { ProfileTabs, type ProfileTab } from "@/components/profile/ProfileTabs";
import { PlayerLink } from "@/components/ui/PlayerLink";
import styles from "./page.module.css";

// Écran Profil (SPEC_ECRAN_PROFIL_V0_1, CLOSE) — 4ème onglet de la nav.
// Remplace le stub "à venir" (22/07/2026) et le bouton de déconnexion
// temporaire (app/(app)/layout.tsx, §5 de la spec).

function formatArchivedDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso)
  );
}

type SearchParams = {
  tab?: string;
  profileError?: string;
  leagueError?: string;
  leagueJoined?: string;
  newLeagueName?: string;
  newLeagueCode?: string;
};

const VALID_TABS: ProfileTab[] = ["compte", "ligues", "historique", "admin"];

function parseTab(value: string | undefined, isAdmin: boolean): ProfileTab {
  const tab = VALID_TABS.includes(value as ProfileTab) ? (value as ProfileTab) : "compte";
  // "admin" demandé par un non-admin (lien copié, statut changé entre-temps)
  // -> repli silencieux sur "compte", jamais une page d'erreur.
  return tab === "admin" && !isAdmin ? "compte" : tab;
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const profile = await getProfileData();
  if (!profile) redirect("/login"); // ne devrait pas se produire : layout (app) garde déjà la session.

  const activeTab = parseTab(sp.tab, profile.isAdmin);

  const teams = activeTab === "compte" ? await getTeamOptions() : [];
  const leagues = activeTab === "ligues" ? await getMyLeagues() : [];
  const history = activeTab === "historique" ? await getCompetitionHistory() : [];

  return (
    <div className={styles.page}>
      <header className={`${styles.header} hero-banner`}>
        <h1 className={`${styles.pseudo} hero-banner-title`}>{profile.pseudo}</h1>
        {profile.isAdmin && <span className={styles.adminBadge}>Admin</span>}
      </header>

      <ProfileTabs active={activeTab} isAdmin={profile.isAdmin} />

      {activeTab === "compte" && (
        <>
          {sp.profileError && (
            <p className={styles.error} role="alert">
              {sp.profileError}
            </p>
          )}

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Thème</h2>
            <form action={updateThemePreference}>
              <input type="hidden" name="theme" value={profile.theme === "DARK" ? "LIGHT" : "DARK"} />
              <button type="submit" className={styles.secondaryButton}>
                Passer en thème {profile.theme === "DARK" ? "clair" : "sombre"}
              </button>
            </form>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Préférences</h2>
            <form action={updateProfile} className={styles.preferencesForm}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Équipe favorite</span>
                <TeamPicker teams={teams} selectedTeamId={profile.favoriteTeamId} />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Bio</span>
                <textarea
                  name="bio"
                  defaultValue={profile.bio}
                  placeholder="Quelques mots sur toi (facultatif)"
                  rows={3}
                  className={styles.textarea}
                />
              </label>

              <button type="submit" className={styles.primaryButton}>
                Enregistrer
              </button>
            </form>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Rappels</h2>
            <NotificationSettings initialPreference={profile.notificationPreference} />
          </section>
        </>
      )}

      {activeTab === "ligues" && (
        <section className={styles.section}>
          {sp.leagueError && (
            <p className={styles.error} role="alert">
              {sp.leagueError}
            </p>
          )}
          {sp.leagueJoined && (
            <p className={styles.success} role="status">
              Tu as rejoint « {sp.leagueJoined} ».
            </p>
          )}
          {sp.newLeagueName && sp.newLeagueCode && (
            <p className={styles.success} role="status">
              Ligue « {sp.newLeagueName} » créée. Code à partager :{" "}
              <span className={styles.leagueCode}>{sp.newLeagueCode}</span>
            </p>
          )}

          {leagues.length > 0 && (
            <div className={styles.leagueList}>
              {leagues.map((league) => (
                <div key={league.id} className={styles.leagueRow}>
                  <div className={styles.leagueInfo}>
                    <span className={styles.leagueName}>{league.name}</span>
                    <span className={styles.leagueMeta}>
                      {league.memberCount} membre{league.memberCount > 1 ? "s" : ""} · code{" "}
                      <span className={styles.leagueCode}>{league.code}</span>
                    </span>
                  </div>
                  <form action={leaveLeagueFormAction}>
                    <input type="hidden" name="leagueId" value={league.id} />
                    <button type="submit" className={styles.leaveButton}>
                      Quitter
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}

          <div className={styles.leagueForms}>
            <form action={createLeagueFormAction} className={styles.leagueForm}>
              <input
                type="text"
                name="name"
                placeholder="Nom de la nouvelle ligue"
                required
                className={styles.leagueInput}
              />
              <button type="submit" className={styles.secondaryButton}>
                Créer
              </button>
            </form>

            <form action={joinLeagueFormAction} className={styles.leagueForm}>
              <input
                type="text"
                name="code"
                placeholder="Code de ligue reçu d'un ami"
                required
                className={styles.leagueInput}
              />
              <button type="submit" className={styles.secondaryButton}>
                Rejoindre
              </button>
            </form>
          </div>
        </section>
      )}

      {activeTab === "historique" && (
        <section className={styles.section}>
          {history.length === 0 ? (
            <p className={styles.fieldLabel}>Aucune compétition archivée pour l&apos;instant.</p>
          ) : (
            <div className={styles.historyList}>
              {history.map((entry) => (
                <div key={entry.competitionId} className={styles.historyRow}>
                  <div className={styles.historyHeader}>
                    <span className={styles.leagueName}>{entry.name}</span>
                    {entry.archivedAt && (
                      <span className={styles.leagueMeta}>{formatArchivedDate(entry.archivedAt)}</span>
                    )}
                  </div>
                  {entry.superlatives.length > 0 && (
                    <ul className={styles.superlativeList}>
                      {entry.superlatives.map((s, i) => (
                        <li key={`${s.kind}-${i}`} className={styles.superlativeItem}>
                          <span className={styles.superlativeLabel}>{s.label}</span> —{" "}
                          <PlayerLink userId={s.userId} pseudo={s.pseudo} /> ({s.value})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "admin" && profile.isAdmin && (
        <section className={styles.section}>
          <Link href="/admin" className={styles.adminLink}>
            Tableau de bord admin
          </Link>
        </section>
      )}

      <section className={styles.section}>
        <form action={logout}>
          <button type="submit" className={styles.logoutButton}>
            Déconnexion
          </button>
        </form>
      </section>
    </div>
  );
}
