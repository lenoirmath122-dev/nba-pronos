import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { getPlayerProfile } from "@/lib/queries/player-profile";
import { ScreenShell } from "@/components/nav/ScreenShell";
import { EmptyState } from "@/components/home/EmptyState";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { BadgesTab } from "@/components/badges/BadgesTab";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileTabsNav } from "@/components/profile/ProfileTabsNav";
import { getProfileBadges, getRowShowcases } from "@/lib/queries/badges";
import { WeeklyPalmares, hasWeeklyPalmaresToShow } from "@/components/profile/WeeklyPalmares";
import { getWeeklyPalmares } from "@/lib/queries/weeklyPalmares";
import styles from "./page.module.css";
import type { Metadata } from "next";

// Page "profil joueur" (BACKLOG discuté le 30/07/2026 — voir
// JOURNAL_SESSIONS.md) : route physique dédiée, hors des groupes
// (public)/(app), même patron que /leaderboard et /bracket (T6a §3.2/§8.1)
// — visiteur ou joueur connecté, la RLS reste seule autorité de visibilité.
// Nav INCHANGÉE (toujours 4 onglets) : cette page se rejoint uniquement en
// cliquant un pseudo déjà affiché ailleurs (Classement, drill-down du
// Bracket, panneau "autres joueurs" de Mes pronos), jamais depuis la nav.

// Profil d'un autre joueur (Lot 3b) : seulement ce qui est public.
const PLAYER_TABS = [
  { key: "pronos", label: "Pronos & paris" },
  { key: "badges", label: "Badges" },
] as const;

function parsePlayerTab(value: string | undefined): "pronos" | "badges" {
  return value === "badges" ? "badges" : "pronos";
}

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

// Profils de joueurs : jamais indexés (pseudos), mais les liens sont suivis.
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default async function PlayerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { userId } = await params;

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Son propre profil : la page « Mon profil » (onglets privés compris).
  if (user?.id === userId) redirect("/profile");

  const [profile, palmares] = await Promise.all([getPlayerProfile(userId), getWeeklyPalmares(supabase, userId)]);
  if (!profile) redirect("/leaderboard");

  const tab = parsePlayerTab((await searchParams).tab);
  const [showcases, badges] = await Promise.all([
    getRowShowcases([userId], 3).catch(() => new Map()),
    tab === "badges" ? getProfileBadges(userId) : Promise.resolve(null),
  ]);

  return (
    <ScreenShell authenticated={user !== null}>
      <div className={`${styles.page} photo-page`}>
        <ProfileHeader
          userId={profile.userId}
          pseudo={profile.pseudo}
          favoriteTeam={profile.favoriteTeam}
          isAdmin={profile.isAdmin}
          isInactive={profile.isInactive}
          bio={profile.bio}
          showcase={showcases.get(userId) ?? []}
          chips={
            profile.rank !== null ? [{ label: `#${profile.rank} · ${profile.totalPoints ?? 0} pts`, accent: true }] : []
          }
          badgesHref={`/players/${userId}?tab=badges`}
        />
        <ProfileTabsNav active={tab} tabs={PLAYER_TABS} basePath={`/players/${userId}?tab=`} />

        {badges && (
          <section className={`${styles.section} glass-card`} aria-label="Badges">
            <BadgesTab data={badges} readOnly />
          </section>
        )}

        {tab === "pronos" && (
          <>
            {/* Palmarès hebdo : toutes compétitions, donc avant la condition sur la
                compétition active. Masqué s'il n'y a aucune victoire à montrer. */}
            {hasWeeklyPalmaresToShow(palmares) && (
              <section className={`${styles.section} glass-card`}>
                <h2 className={styles.sectionTitle}>Palmarès hebdo</h2>
                <WeeklyPalmares data={palmares} variant="other" />
              </section>
            )}

            {profile.competitionId === null ? (
              <EmptyState title="Aucune compétition en cours" subtitle="Rien à montrer pour l'instant." />
            ) : (
              <>
                <section className={`${styles.section} glass-card`}>
                  <h2 className={styles.sectionTitle}>Classement — {profile.competitionName}</h2>
                  {profile.rank === null ? (
                    <p className={styles.muted}>N&apos;a encore rien pronostiqué sur cette compétition.</p>
                  ) : (
                    <p className={styles.rankLine}>
                      <span className={styles.rankValue}>#{profile.rank}</span>
                      <span className={styles.mutedInline}>{profile.totalPoints} pts</span>
                    </p>
                  )}
                </section>

                <section className={`${styles.section} glass-card`}>
                  <h2 className={styles.sectionTitle}>Bracket</h2>
                  {!profile.isBracketRevealed ? (
                    <p className={styles.muted}>
                      Se révèle après la deadline du bracket
                      {profile.bracketDeadline ? ` (${DATE_FORMATTER.format(new Date(profile.bracketDeadline))})` : ""}.
                    </p>
                  ) : profile.bracketPicks.length === 0 ? (
                    <p className={styles.muted}>Aucun bracket rempli.</p>
                  ) : (
                    <ul className={styles.pickList}>
                      {profile.bracketPicks.map((pick) => (
                        <li key={pick.seriesId} className={styles.pickRow}>
                          <span className={styles.pickRound}>{pick.roundLabel}</span>
                          <span className={styles.pickTeams}>
                            {pick.teamA?.abbreviation ?? "?"} vs {pick.teamB?.abbreviation ?? "?"}
                          </span>
                          <span className={styles.pickValue}>
                            {pick.predictedWinner ? (
                              <>
                                <TeamLogo abbreviation={pick.predictedWinner.abbreviation} alt={pick.predictedWinner.name} size={20} />
                                {pick.predictedWinner.abbreviation}
                                {pick.predictedScoreFormat ? ` (${pick.predictedScoreFormat})` : ""}
                              </>
                            ) : (
                              <span className={styles.muted}>Non rempli</span>
                            )}
                          </span>
                          {pick.points !== null && <span className={styles.pickPoints}>{pick.points} pts</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className={`${styles.section} glass-card`}>
                  <h2 className={styles.sectionTitle}>Pronostics de matchs</h2>
                  {profile.matchPredictions.length === 0 ? (
                    <p className={styles.muted}>Aucun pronostic verrouillé pour l&apos;instant.</p>
                  ) : (
                    <ul className={styles.predictionList}>
                      {profile.matchPredictions.map((p) => (
                        <li key={p.matchId} className={styles.predictionRow}>
                          <span className={styles.predictionTeams}>
                            {p.awayTeam.abbreviation} @ {p.homeTeam.abbreviation}
                          </span>
                          <span className={styles.predictionPick}>
                            {/* "+" pas "−" (22/08/2026, même correctif que
                                PredictionSummary.tsx) : predictedMargin est
                                toujours l'écart de victoire, jamais un déficit. */}
                            {p.predictedWinner.abbreviation} +{p.predictedMargin}
                          </span>
                          <span className={styles.mutedInline}>{DATE_FORMATTER.format(new Date(p.scheduledAt))}</span>
                          {p.points !== null && <span className={styles.pickPoints}>{p.points} pts</span>}
                          {p.adminCorrection && (
                            <span className={styles.correctionNote}>
                              Corrigé par {p.adminCorrection.adminName}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className={`${styles.section} glass-card`}>
                  <h2 className={styles.sectionTitle}>Paris</h2>
                  {profile.bets.length === 0 ? (
                    <p className={styles.muted}>Aucun pari résolu pour l&apos;instant.</p>
                  ) : (
                    <ul className={styles.betList}>
                      {profile.bets.map((bet) => (
                        <li key={bet.betId} className={styles.betRow}>
                          <span className={styles.betDescription}>{bet.description}</span>
                          <span className={styles.mutedInline}>
                            {bet.categoryLabel} · {bet.difficultyLabel}
                          </span>
                          {bet.points !== null && <span className={styles.pickPoints}>{bet.points} pts</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </div>
    </ScreenShell>
  );
}
