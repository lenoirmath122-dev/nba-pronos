import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { getPlayerProfile } from "@/lib/queries/player-profile";
import { ScreenShell } from "@/components/nav/ScreenShell";
import { EmptyState } from "@/components/home/EmptyState";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { PinnedBadges } from "@/components/profile/PinnedBadges";
import styles from "./page.module.css";

// Page "profil joueur" (BACKLOG discuté le 30/07/2026 — voir
// JOURNAL_SESSIONS.md) : route physique dédiée, hors des groupes
// (public)/(app), même patron que /leaderboard et /bracket (T6a §3.2/§8.1)
// — visiteur ou joueur connecté, la RLS reste seule autorité de visibilité.
// Nav INCHANGÉE (toujours 4 onglets) : cette page se rejoint uniquement en
// cliquant un pseudo déjà affiché ailleurs (Classement, drill-down du
// Bracket, panneau "autres joueurs" de Mes pronos), jamais depuis la nav.

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function PlayerProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getPlayerProfile(userId);
  if (!profile) redirect("/leaderboard");

  return (
    <ScreenShell authenticated={user !== null}>
      <div className={`${styles.page} photo-page`}>
        <header className={`${styles.header} hero-banner glass-card`}>
          <p className={`${styles.pseudo} hero-banner-title`}>
            {profile.pseudo}
            <PinnedBadges badges={profile.pinnedBadges} />
          </p>
          <div className={styles.badges}>
            {profile.isAdmin && <span className={styles.badge}>Admin</span>}
            {profile.isInactive && <span className={styles.badge}>Compte désactivé</span>}
          </div>
          {profile.favoriteTeam && (
            <div className={styles.favoriteTeam}>
              <TeamLogo abbreviation={profile.favoriteTeam.abbreviation} alt={profile.favoriteTeam.name} size={28} />
              <span>{profile.favoriteTeam.name}</span>
            </div>
          )}
          {profile.bio && <p className={styles.bio}>{profile.bio}</p>}
        </header>

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
      </div>
    </ScreenShell>
  );
}
