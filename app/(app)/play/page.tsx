import Link from "next/link";
import { getPlayUpcoming } from "@/lib/queries/play";
import { EmptyState } from "@/components/home/EmptyState";
import { PlayTabs } from "@/components/play/PlayTabs";
import { BracketEntry } from "@/components/play/BracketEntry";
import { RuleHelpButton } from "@/components/regles/RuleHelpButton";
import { MatchBaremeGrid } from "@/components/regles/MatchBaremeGrid";
import { ValidateAllBanner } from "@/components/play/ValidateAllBanner";
import { MatchDayGroup } from "@/components/play/MatchDayGroup";
import { BeyondWindowSection } from "@/components/play/BeyondWindowSection";
import { LiveTicker } from "@/components/play/LiveTicker";
import { formatPronoRecap } from "@/lib/labels/pronos";
import styles from "./page.module.css";

// Onglet "Mes pronos" (à suivre) — SPEC_REFONTE_ONGLET_JOUER_V0_1 §3.
// Remplace l'ancien hub à cartes ET l'écran Matchs ET le segment "Récent" de
// l'ex-écran Mes pronos. Composant SERVEUR, aucun fetch client — la fenêtre,
// le tri et la dérivation d'état sont déjà calculés par
// lib/queries/play.ts::getPlayUpcoming ; cette page ne fait que composer.
//
// Les matchs commencés (réglés ou non) vivent dans l'onglet Résultats.

export default async function PlayUpcomingPage() {
  const data = await getPlayUpcoming();

  if (!data) {
    return (
      <div className={`${styles.page} photo-page`}>
        <div className={`${styles.header} glass-card`}>
          <h1 className={styles.title}>Jouer</h1>
        </div>
        <EmptyState title="Aucune compétition en cours" subtitle="La prochaine arrive bientôt." />
      </div>
    );
  }

  const hasUpcoming = data.days.length > 0;
  const hasBeyondWindow = data.daysBeyondWindow.length > 0;
  const isEmpty = !hasUpcoming && !hasBeyondWindow;

  const readyMatches = data.days
    .flatMap((day) => day.matches)
    .filter((match) => match.viewStatus === "READY")
    .map((match) => ({
      matchId: match.matchId,
      label: `${match.homeTeam.abbreviation} – ${match.awayTeam.abbreviation}`,
      // "READY" garantit vainqueur et écart déjà enregistrés.
      recap:
        match.myWinnerTeamId === match.homeTeam.id
          ? formatPronoRecap(match.homeTeam.abbreviation, match.awayTeam.abbreviation, match.myMargin ?? 0)
          : formatPronoRecap(match.awayTeam.abbreviation, match.homeTeam.abbreviation, match.myMargin ?? 0),
    }));

  return (
    <div className={`${styles.page} photo-page`}>
      <div className={`${styles.header} glass-card`}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Jouer</h1>
          <RuleHelpButton title="Barème par match" label="Comment sont notés les pronos">
            <MatchBaremeGrid />
          </RuleHelpButton>
        </div>
        <BracketEntry />
      </div>
      <PlayTabs active="UPCOMING" />

      {isEmpty ? (
        <EmptyState
          title="Aucun match à pronostiquer pour l'instant"
          subtitle="Les prochaines affiches s'afficheront ici dès qu'elles seront connues."
          action={<Link href="/play/results">Voir les résultats</Link>}
        />
      ) : (
        <>
          {data.readyCount > 0 && <ValidateAllBanner readyMatches={readyMatches} />}

          {data.days.map((day) => (
            <MatchDayGroup key={day.key} day={day} />
          ))}

          {hasBeyondWindow && <BeyondWindowSection days={data.daysBeyondWindow} />}
        </>
      )}

      <LiveTicker liveScores={data.liveScores} days={data.days} />
    </div>
  );
}
