import { getMatches } from "@/lib/queries/matches";
import { EmptyState } from "@/components/home/EmptyState";
import { MatchDayGroup } from "@/components/matches/MatchDayGroup";
import { ValidateAllBanner } from "@/components/matches/ValidateAllBanner";
import styles from "./page.module.css";

// Écran Matchs (SPEC_ECRAN_MATCHS §1) : composant serveur, aucun fetch client.
// Fenêtre 3 jours, statuts et confidentialité déjà calculés par
// lib/queries/matches.ts — cette page ne fait que composer et choisir entre
// les 3 états vides (§15) et le rendu normal.
export default async function MatchesPage() {
  const { competitionId, days, readyCount } = await getMatches();

  if (competitionId === null) {
    return (
      <div className={styles.page}>
        <div className={`${styles.header} hero-banner`}>
          <h1 className={`${styles.title} hero-banner-title`}>Matchs</h1>
        </div>
        <EmptyState title="Aucune compétition en cours" subtitle="La prochaine arrive bientôt." />
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className={styles.page}>
        <div className={`${styles.header} hero-banner`}>
          <h1 className={`${styles.title} hero-banner-title`}>Matchs</h1>
        </div>
        <EmptyState
          title="Aucun match à pronostiquer pour l'instant"
          subtitle="Les prochaines affiches s'afficheront ici dès qu'elles seront connues."
        />
      </div>
    );
  }

  const allMatches = days.flatMap((day) => day.matches);
  const allValidated = allMatches.every((match) => match.viewStatus === "VALIDATED");

  if (allValidated) {
    return (
      <div className={styles.page}>
        <div className={`${styles.header} hero-banner`}>
          <h1 className={`${styles.title} hero-banner-title`}>Matchs</h1>
        </div>
        <EmptyState title="Tout est validé" subtitle="Tu es à jour sur les 3 prochains jours." />
      </div>
    );
  }

  const readyMatches = allMatches
    .filter((match) => match.viewStatus === "READY")
    .map((match) => ({
      matchId: match.matchId,
      label: `${match.homeTeam.abbreviation} – ${match.awayTeam.abbreviation}`,
    }));

  return (
    <div className={styles.page}>
      <div className={`${styles.header} hero-banner`}>
        <h1 className={`${styles.title} hero-banner-title`}>Matchs</h1>
      </div>
      {readyCount > 0 && <ValidateAllBanner readyMatches={readyMatches} />}
      {days.map((day) => (
        <MatchDayGroup key={day.key} day={day} />
      ))}
    </div>
  );
}
