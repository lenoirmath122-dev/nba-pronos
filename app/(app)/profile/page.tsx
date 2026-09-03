import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getProfileData, getTeamOptions } from "@/lib/queries/profile";
import { TEAM_COLORS } from "@/lib/labels/teamColors";
import { getMyLeagues } from "@/lib/queries/leagues";
import { getCompetitionHistory } from "@/lib/queries/history";
import { getProfileStats } from "@/lib/queries/stats";
import { getProfileBadges } from "@/lib/queries/badges";
import { updateThemePreference, updateBackgroundTheme, updateProfile } from "@/lib/actions/profile";
import { createLeagueFormAction, joinLeagueFormAction, leaveLeagueFormAction } from "@/lib/actions/leagues";
import { deleteAccountFormAction } from "@/lib/actions/account";
import { logout } from "@/lib/auth/actions";
import { TeamPicker } from "@/components/profile/TeamPicker";
import { CollapsibleCard } from "@/components/home/CollapsibleCard";
import { NotificationSettings } from "@/components/profile/NotificationSettings";
import { ProfileTabs, type ProfileTab } from "@/components/profile/ProfileTabs";
import { LeagueScopeChips } from "@/components/profile/LeagueScopeChips";
import { RankEvolutionChart } from "@/components/profile/RankEvolutionChart";
import { BadgesSection } from "@/components/profile/BadgesSection";
import { PinnedBadges } from "@/components/profile/PinnedBadges";
import { ProgressBar } from "@/components/bracket/ProgressBar";
import { PlayerLink } from "@/components/ui/PlayerLink";
import styles from "./page.module.css";

// Écran Profil (SPEC_ECRAN_PROFIL_V0_1, CLOSE) — 4ème onglet de la nav.
// Remplace le stub "à venir" (22/07/2026) et le bouton de déconnexion
// temporaire (app/(app)/layout.tsx, §5 de la spec).

// Options du sélecteur « Thème » (06/08/2026) — Sombre/Clair/Photo, 3 choix
// mutuellement exclusifs depuis la fusion avec l'ancien fond d'écran
// indépendant (migrations 20260806100000/20260806110000).
const THEMES: { value: "DARK" | "LIGHT" | "PHOTO"; label: string }[] = [
  { value: "DARK", label: "Sombre" },
  { value: "LIGHT", label: "Clair" },
  { value: "PHOTO", label: "Photo" },
];

// Options du sous-sélecteur de photo, affiché seulement si le thème Photo
// est actif — miroir de background_theme (enum Postgres, migration
// 20260806090000). Étendre plus tard = 1 nouvel item ici + 1 valeur d'enum +
// 1 override [data-bg="..."] dans app/tokens.css + les 2 assets
// (hero-<x>.jpg, hero-<x>-thumb.jpg).
const BACKGROUND_THEMES: { value: "MURAL" | "HOOP" | "HK"; label: string; thumb: string }[] = [
  { value: "MURAL", label: "Fresque streetball", thumb: "/brand/hero-mural-thumb.jpg" },
  { value: "HOOP", label: "Panier vu du dessus", thumb: "/brand/hero-hoop-thumb.jpg" },
  { value: "HK", label: "Terrain à Hong Kong", thumb: "/brand/hero-hk-thumb.jpg" },
];

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
  ligue?: string;
};

const VALID_TABS: ProfileTab[] = ["compte", "stats", "ligues", "historique", "admin"];

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
  const stats = activeTab === "stats" ? await getProfileStats(sp.ligue) : null;
  const statsLeagues = activeTab === "stats" ? await getMyLeagues() : [];
  // Badges permanents (09/08/2026, phase 1) — à VIE, indépendants d'une
  // compétition active, cf. SPEC_BADGES_PERMANENTS_V0_1.md. Fetch séparé de
  // getProfileStats (scopée à la compétition ACTIVE). Chargé sur TOUS les
  // onglets depuis le 27/08/2026 (pinnedBadges affichés dans le bandeau,
  // toujours visible) — requête légère (une seule vue), coût négligeable.
  const badges = await getProfileBadges();

  // Personnalisation par équipe favorite (04/08/2026, spec validée par
  // maquettes — cf. lib/labels/teamColors.ts) : réduite au blason depuis le
  // 15/08/2026 (demandé par l'utilisateur — le bandeau doit avoir le même
  // fond que les autres cartes, cf. commentaire .hero-banner globals.css ;
  // le dégradé aux couleurs de l'équipe masquait ce fond, retiré). Rien ne
  // s'affiche si aucune équipe favorite n'est choisie.
  const teamColors = profile.favoriteTeam ? TEAM_COLORS[profile.favoriteTeam.abbreviation] : null;

  return (
    <div className={`${styles.page} photo-page`}>
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
      >
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
            <PinnedBadges badges={badges.pinnedBadges} />
          </h1>
          {profile.isAdmin && <span className={styles.adminBadge}>Admin</span>}
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

          <section className={`${styles.section} glass-card`}>
            <h2 className={styles.sectionTitle}>Thème</h2>
            <div className={styles.themePicker}>
              {THEMES.map((t) => {
                const isActive = profile.theme === t.value;
                return (
                  <form key={t.value} action={updateThemePreference}>
                    <input type="hidden" name="theme" value={t.value} />
                    <button
                      type="submit"
                      className={isActive ? `${styles.themeOption} ${styles.themeOptionActive}` : styles.themeOption}
                      aria-pressed={isActive}
                      disabled={isActive}
                    >
                      {t.label}
                    </button>
                  </form>
                );
              })}
            </div>

            {profile.theme === "PHOTO" && (
              <div className={styles.bgPicker}>
                {BACKGROUND_THEMES.map((bg) => {
                  const isActive = profile.backgroundTheme === bg.value;
                  return (
                    <form key={bg.value} action={updateBackgroundTheme}>
                      <input type="hidden" name="backgroundTheme" value={bg.value} />
                      <button
                        type="submit"
                        className={isActive ? `${styles.bgOption} ${styles.bgOptionActive}` : styles.bgOption}
                        aria-pressed={isActive}
                        disabled={isActive}
                      >
                        <Image
                          src={bg.thumb}
                          alt=""
                          width={96}
                          height={96}
                          unoptimized
                          className={styles.bgThumb}
                        />
                        <span className={styles.bgLabel}>{bg.label}</span>
                      </button>
                    </form>
                  );
                })}
              </div>
            )}
          </section>

          <section className={`${styles.section} glass-card`}>
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
                  maxLength={2000}
                  className={styles.textarea}
                />
              </label>

              <button type="submit" className={styles.primaryButton}>
                Enregistrer
              </button>
            </form>
          </section>

          <section className={`${styles.section} glass-card`}>
            <h2 className={styles.sectionTitle}>Rappels</h2>
            <NotificationSettings initialPreference={profile.notificationPreference} />
          </section>

          <section className={`${styles.section} glass-card`}>
            <h2 className={styles.sectionTitle}>Aide</h2>
            <Link href="/regles" className={styles.helpLink}>
              Règles du jeu
            </Link>
          </section>

          <section className={`${styles.section} glass-card`}>
            <h2 className={styles.sectionTitle}>Informations légales</h2>
            <Link href="/mentions-legales" className={styles.helpLink}>
              Mentions légales
            </Link>
            <Link href="/confidentialite" className={styles.helpLink}>
              Politique de confidentialité
            </Link>
            <Link href="/cgu" className={styles.helpLink}>
              Conditions générales d&apos;utilisation
            </Link>
          </section>

          <section className={`${styles.section} glass-card`}>
            <h2 className={styles.sectionTitle}>Mes données</h2>
            <p className={styles.fieldLabel}>
              Télécharge une copie de tes données personnelles (profil, paris, messages de chat, signalements de
              bug, ligues) au format JSON.
            </p>
            <a href="/api/account/export" className={styles.helpLink}>
              Télécharger mes données
            </a>
          </section>

          <section className={`${styles.section} glass-card`}>
            <h2 className={styles.sectionTitle}>Zone de danger</h2>
            <p className={styles.fieldLabel}>
              Supprimer ton compte efface définitivement ton profil, tes paris, tes pronostics, tes messages de
              chat et tes signalements. Cette action est irréversible.
            </p>
            <form action={deleteAccountFormAction} className={styles.dangerForm}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>
                  Tape ton pseudo « {profile.pseudo} » pour confirmer
                </span>
                <input
                  type="text"
                  name="pseudoConfirm"
                  required
                  autoComplete="off"
                  className={styles.leagueInput}
                />
              </label>
              <button type="submit" className={styles.logoutButton}>
                Supprimer définitivement mon compte
              </button>
            </form>
          </section>
        </>
      )}

      {activeTab === "stats" && stats && (
        <>
          {!stats.hasActiveCompetition ? (
            <section className={`${styles.section} glass-card`}>
              <p className={styles.fieldLabel}>Aucune compétition en cours.</p>
            </section>
          ) : (
            <>
              <div className={styles.totalHero}>
                <span className={styles.totalHeroValue}>{stats.pointsBreakdown.totalPoints}</span>
                <span className={styles.totalHeroLabel}>points cette compétition</span>
              </div>

              <section className={`${styles.section} glass-card`} aria-label="Précision">
                <CollapsibleCard id="stats-accuracy" title="Précision" defaultOpen>
                  {stats.accuracy.totalScoredPredictions === 0 ? (
                    <p className={styles.fieldLabel}>Pas encore de match scoré cette compétition.</p>
                  ) : (
                    <>
                      <ProgressBar
                        filledCount={stats.accuracy.correctWinners}
                        totalCount={stats.accuracy.totalScoredPredictions}
                        label={`Précision bons vainqueurs : ${stats.accuracy.correctWinners} sur ${stats.accuracy.totalScoredPredictions}`}
                      />
                      <ProgressBar
                        filledCount={stats.accuracy.exactMargins}
                        totalCount={stats.accuracy.totalScoredPredictions}
                        label={`Précision écarts exacts : ${stats.accuracy.exactMargins} sur ${stats.accuracy.totalScoredPredictions}`}
                      />
                    </>
                  )}
                  <div className={styles.statGrid}>
                    <div className={styles.statCard}>
                      <span className={styles.statCardLabel}>Points matchs</span>
                      <span className={styles.statCardValue}>{stats.pointsBreakdown.matchesPoints}</span>
                    </div>
                    <div className={styles.statCard}>
                      <span className={styles.statCardLabel}>Points bracket</span>
                      <span className={styles.statCardValue}>{stats.pointsBreakdown.bracketPoints}</span>
                    </div>
                    <div className={styles.statCard}>
                      <span className={styles.statCardLabel}>Points paris</span>
                      <span className={styles.statCardValue}>{stats.pointsBreakdown.betsPoints}</span>
                    </div>
                  </div>
                </CollapsibleCard>
              </section>

              <section className={`${styles.section} glass-card`} aria-label="Comparaison">
                <CollapsibleCard id="stats-comparison" title="Comparaison" defaultOpen>
                  <LeagueScopeChips myLeagues={statsLeagues} activeLeagueId={stats.comparison.scopeLeagueId} />
                  <div className={styles.compareRow}>
                    <span>
                      <span className={styles.compareRank}>
                        {stats.rank.value !== null ? `#${stats.rank.value}` : "—"}
                      </span>
                      <span className={styles.compareRankTotal}> / {stats.rank.totalPlayers} joueur{stats.rank.totalPlayers > 1 ? "s" : ""}</span>
                    </span>
                    <span className={styles.compareDelta}>
                      {stats.comparison.deltaVsAverage >= 0 ? "+" : ""}
                      {stats.comparison.deltaVsAverage} pts vs moyenne ({stats.comparison.othersAveragePoints})
                    </span>
                  </div>
                </CollapsibleCard>
              </section>

              <section className={`${styles.section} glass-card`} aria-label="Évolution du classement">
                <CollapsibleCard id="stats-evolution" title="Évolution du classement">
                  {stats.evolution.series.length >= 2 ? (
                    <>
                      <div className={styles.chartWrapper}>
                        <RankEvolutionChart series={stats.evolution.series} />
                      </div>
                      <p className={styles.chartCaption}>
                        Toujours en classement général, même si un filtre ligue est actif ci-dessus.
                      </p>
                    </>
                  ) : (
                    <p className={styles.fieldLabel}>
                      Reviens dans quelques jours pour voir ta courbe d&rsquo;évolution.
                    </p>
                  )}
                </CollapsibleCard>
              </section>

              <section className={`${styles.section} glass-card`} aria-label="Paris">
                <CollapsibleCard id="stats-bets" title="Paris" count={stats.betRecord.resolvedCount}>
                  {stats.betRecord.resolvedCount === 0 ? (
                    <p className={styles.fieldLabel}>Aucun pari résolu pour l&rsquo;instant.</p>
                  ) : (
                    <>
                      <div className={styles.betRecordRow}>
                        <div className={styles.betStat}>
                          <span className={styles.betStatValueWon}>{stats.betRecord.wonCount}</span>
                          <span className={styles.betStatLabel}>Gagnés</span>
                        </div>
                        <div className={styles.betStat}>
                          <span className={styles.betStatValueLost}>{stats.betRecord.lostCount}</span>
                          <span className={styles.betStatLabel}>Perdus</span>
                        </div>
                        <div className={styles.betStat}>
                          <span className={styles.betStatValue}>{stats.betRecord.winRatePct}%</span>
                          <span className={styles.betStatLabel}>Réussite</span>
                        </div>
                      </div>
                      {stats.betRecord.bestWin && (
                        <div className={styles.bestWin}>
                          <span className={styles.bestWinTag}>Plus gros coup</span>
                          <span className={styles.bestWinDesc}>« {stats.betRecord.bestWin.description} »</span>
                          <span className={styles.bestWinMeta}>
                            {stats.betRecord.bestWin.difficultyLabel} · +{stats.betRecord.bestWin.points} pts
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </CollapsibleCard>
              </section>
            </>
          )}

          <section className={`${styles.section} glass-card`} aria-label="Badges">
            <CollapsibleCard
              id="stats-badges"
              title="Badges"
              count={
                badges.categories
                  .flatMap((c) => c.badges)
                  .filter((b) => (b.kind === "tiered" ? b.tier !== null : b.unlocked)).length
              }
            >
              <BadgesSection data={badges} />
            </CollapsibleCard>
          </section>
        </>
      )}

      {activeTab === "ligues" && (
        <section className={`${styles.section} glass-card`}>
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
        <section className={`${styles.section} glass-card`}>
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
        <section className={`${styles.section} glass-card`}>
          <Link href="/admin" className={styles.adminLink}>
            Tableau de bord admin
          </Link>
        </section>
      )}

      <section className={`${styles.section} glass-card`}>
        <form action={logout}>
          <button type="submit" className={styles.logoutButton}>
            Déconnexion
          </button>
        </form>
      </section>
    </div>
  );
}
