import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getProfileData, getTeamOptions } from "@/lib/queries/profile";
import { TEAM_COLORS } from "@/lib/labels/teamColors";
import { getMyLeagues } from "@/lib/queries/leagues";
import { getCompetitionHistory } from "@/lib/queries/history";
import { updateThemePreference, updateProfile } from "@/lib/actions/profile";
import { createLeagueFormAction, joinLeagueFormAction, leaveLeagueFormAction } from "@/lib/actions/leagues";
import { logout } from "@/lib/auth/actions";
import { TeamPicker } from "@/components/profile/TeamPicker";
import { NotificationSettings } from "@/components/profile/NotificationSettings";
import { ProfileTabs, type ProfileTab } from "@/components/profile/ProfileTabs";
import { PlayerLink } from "@/components/ui/PlayerLink";
import { TutorialLink } from "@/components/tutorial/TutorialLink";
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

  // Bandeau personnalisé par équipe favorite (04/08/2026, spec validée par
  // maquettes — cf. lib/labels/teamColors.ts). Rien ne change si aucune
  // équipe favorite n'est choisie.
  const teamColors = profile.favoriteTeam ? TEAM_COLORS[profile.favoriteTeam.abbreviation] : null;

  return (
    <div className={styles.page}>
      {/* Liseré blanc du blason (filter: url(#profile-crest-outline), CSS
          module) : silhouette dilatée + composée en blanc, PAS un simple
          border (ne suivrait pas le contour du blason). Un seul filtre pour
          l'écran, peu importe l'équipe (le SVG source change, pas le filtre). */}
      {teamColors && (
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
          <defs>
            <filter id="profile-crest-outline" x="-40%" y="-40%" width="180%" height="180%">
              <feMorphology in="SourceAlpha" operator="dilate" radius="2.5" result="dilated" />
              <feFlood floodColor="#ffffff" result="white" />
              <feComposite in="white" in2="dilated" operator="in" result="outline" />
              <feMerge>
                <feMergeNode in="outline" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </svg>
      )}
      <header
        className={teamColors ? `${styles.header} ${styles.headerTeam} hero-banner` : `${styles.header} hero-banner`}
        style={
          teamColors
            ? ({ "--team-primary": teamColors.primary, "--team-secondary": teamColors.secondary } as CSSProperties)
            : undefined
        }
      >
        {teamColors && <span className={styles.textScrim} aria-hidden="true" />}
        {teamColors && profile.favoriteTeam && (
          <Image
            src={`/logos/teams/${profile.favoriteTeam.abbreviation}.svg`}
            alt={profile.favoriteTeam.name}
            width={200}
            height={200}
            unoptimized
            className={styles.crestBadge}
          />
        )}
        <div className={styles.headerText}>
          <h1 className={`${styles.pseudo}${teamColors ? ` ${styles.pseudoTeam}` : ""} hero-banner-title`}>
            {profile.pseudo}
          </h1>
          {profile.isAdmin && (
            <span className={teamColors ? `${styles.adminBadge} ${styles.adminBadgeTeam}` : styles.adminBadge}>
              Admin
            </span>
          )}
        </div>
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

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Aide</h2>
            <TutorialLink />
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
