import type { AdminSeriesNode } from "@/lib/queries/admin-results";
import { createMatchFormAction, saveMatchResultFormAction } from "@/lib/actions/admin-results";
import styles from "./SeriesResultsCard.module.css";

// Une série de l'écran Saisie des résultats (SPEC_ECRAN_ADMIN_RESULTATS_V0_1
// §2) : en-tête (équipes + statut officiel), liste des matchs déjà créés
// (1 formulaire d'édition par match) et — conditionnel — le formulaire
// « Ajouter un match ». Composant serveur, aucun "use client".

const SERIES_STATUS_LABEL: Record<AdminSeriesNode["officialStatus"], string> = {
  SCHEDULED: "À venir",
  IN_PROGRESS: "En cours",
  FINISHED: "Terminée",
  POSTPONED: "Reportée",
  CANCELLED: "Annulée",
};

const MATCH_STATUS_OPTIONS: { value: AdminSeriesNode["matches"][number]["status"]; label: string }[] = [
  { value: "SCHEDULED", label: "Programmé" },
  { value: "IN_PROGRESS", label: "En cours" },
  { value: "FINISHED", label: "Terminé" },
  { value: "POSTPONED", label: "Reporté" },
  { value: "CANCELLED", label: "Annulé" },
];

type SeriesResultsCardProps = {
  node: AdminSeriesNode;
  errorMatchId?: string;
  errorSeriesId?: string;
  errorMessage?: string;
};

export function SeriesResultsCard({ node, errorMatchId, errorSeriesId, errorMessage }: SeriesResultsCardProps) {
  const canAddMatch =
    node.team1 !== null &&
    node.team2 !== null &&
    node.officialStatus !== "FINISHED" &&
    node.officialStatus !== "CANCELLED" &&
    node.matches.length < 7;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <p className={styles.matchup}>
          {node.team1 ? node.team1.abbreviation : "Équipe à venir"}
          {" — "}
          {node.team2 ? node.team2.abbreviation : "Équipe à venir"}
        </p>
        <span className={styles.statusBadge} data-status={node.officialStatus}>
          {SERIES_STATUS_LABEL[node.officialStatus]}
        </span>
      </div>
      {node.officialStatus === "FINISHED" && node.officialWinner && (
        <p className={styles.winner}>Vainqueur : {node.officialWinner.abbreviation}</p>
      )}

      {node.matches.length > 0 && (
        <ul className={styles.matchList}>
          {node.matches.map((match) => (
            <li key={match.id} className={styles.matchRow}>
              <p className={styles.matchLabel}>
                Match {match.gameNumber} — {match.homeTeam.abbreviation} vs {match.awayTeam.abbreviation}
                {match.scheduledAt && (
                  <span className={styles.matchDate}>
                    {" · "}
                    {new Date(match.scheduledAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                )}
              </p>
              {errorMatchId === match.id && errorMessage && (
                <p className={styles.error} role="alert">
                  {errorMessage}
                </p>
              )}
              <form action={saveMatchResultFormAction} className={styles.resultForm}>
                <input type="hidden" name="matchId" value={match.id} />
                <select name="status" defaultValue={match.status} className={styles.select}>
                  {MATCH_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <label className={styles.scoreField}>
                  <span className={styles.scoreTeamLabel}>{match.homeTeam.abbreviation}</span>
                  <input
                    type="number"
                    name="homeScore"
                    min={0}
                    inputMode="numeric"
                    defaultValue={match.homeScore ?? ""}
                    className={styles.scoreInput}
                  />
                </label>
                <span className={styles.scoreSeparator}>–</span>
                <label className={styles.scoreField}>
                  <span className={styles.scoreTeamLabel}>{match.awayTeam.abbreviation}</span>
                  <input
                    type="number"
                    name="awayScore"
                    min={0}
                    inputMode="numeric"
                    defaultValue={match.awayScore ?? ""}
                    className={styles.scoreInput}
                  />
                </label>
                <button type="submit" className={styles.saveButton}>
                  Enregistrer
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {canAddMatch && (
        <div className={styles.addMatch}>
          {errorSeriesId === node.id && errorMessage && (
            <p className={styles.error} role="alert">
              {errorMessage}
            </p>
          )}
          <form action={createMatchFormAction} className={styles.addForm}>
            <input type="hidden" name="seriesId" value={node.id} />
            <fieldset className={styles.homeFieldset}>
              <legend className={styles.homeLegend}>À domicile</legend>
              <label className={styles.radioLabel}>
                <input type="radio" name="homeTeamId" value={node.team1?.id} defaultChecked /> {node.team1?.abbreviation}
              </label>
              <label className={styles.radioLabel}>
                <input type="radio" name="homeTeamId" value={node.team2?.id} /> {node.team2?.abbreviation}
              </label>
            </fieldset>
            <input type="datetime-local" name="scheduledAt" className={styles.dateInput} />
            <button type="submit" className={styles.addButton}>
              Ajouter un match
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
