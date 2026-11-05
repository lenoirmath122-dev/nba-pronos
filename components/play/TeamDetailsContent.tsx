import type { PlayerSeasonLine, TeamInsights, TeamInsightsResponse } from "@/lib/teamInsights/types";
import { FORM_LABEL_TEXT, STAT_LEGEND, TREND_TEXT, formatSignedDiff } from "@/lib/teamInsights/display";
import { parisDateTimeLabel } from "@/lib/dates/paris";
import styles from "./TeamDetailsContent.module.css";

// Contenu de la popup « Détail des équipes » : une section par équipe (résumé
// de forme, 3 joueurs clés, effectif complet) puis la légende débutant.
// Habillage minimal (lot 4), rendu définitif en session « visuel ».

const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)} %`);
const one = (v: number) => v.toFixed(1).replace(".", ",");

function PlayerRow({ p }: { p: PlayerSeasonLine }) {
  return (
    <tr>
      <th scope="row">
        {p.name}
        {p.isUsualStarter ? <span className={styles.tag}> · titulaire</span> : null}
        {p.joinedMidSeason ? <span className={styles.tag}> · arrivé en cours de saison</span> : null}
        {p.trend && p.trend !== "STABLE" ? <span className={styles.tag}> · {TREND_TEXT[p.trend]}</span> : null}
      </th>
      <td>{p.gamesPlayed}</td>
      <td>{one(p.minutes)}</td>
      <td>{one(p.pts)}</td>
      <td>{one(p.reb)}</td>
      <td>{one(p.ast)}</td>
      <td>{one(p.fg3m)}</td>
      <td>{pct(p.fgPct)}</td>
    </tr>
  );
}

function PlayersTable({ players, caption }: { players: PlayerSeasonLine[]; caption: string }) {
  return (
    <table className={styles.table}>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Joueur</th>
          <th scope="col">Matchs</th>
          <th scope="col">MIN</th>
          <th scope="col">PTS</th>
          <th scope="col">REB</th>
          <th scope="col">PD</th>
          <th scope="col">3PTS</th>
          <th scope="col">% tir</th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => (
          <PlayerRow key={p.playerId} p={p} />
        ))}
      </tbody>
    </table>
  );
}

function TeamSection({ team, teamName }: { team: TeamInsights; teamName: string }) {
  const { form } = team;
  if (!form) {
    return (
      <section className={styles.section}>
        <h3>{teamName}</h3>
        <p>Pas encore de match joué cette saison.</p>
      </section>
    );
  }
  const last5Wins = form.last5.filter((r) => r === "V").length;
  return (
    <section className={styles.section}>
      <h3>{teamName}</h3>
      <p>
        <strong>{FORM_LABEL_TEXT[form.label]}</strong> · {form.record.wins} victoires, {form.record.losses} défaites
        {form.conferenceRank !== null && form.conference
          ? ` · ${form.conferenceRank}${form.conferenceRank === 1 ? "er" : "e"} à ${form.conference === "EAST" ? "l'Est" : "l'Ouest"} (classement indicatif)`
          : ""}
      </p>
      <p>
        5 derniers matchs : {form.last5.join(" ")} ({last5Wins} victoire{last5Wins > 1 ? "s" : ""}), écart moyen{" "}
        {formatSignedDiff(form.pointDiffLast5)} pts. Série en cours : {form.streak.length}{" "}
        {form.streak.type === "V" ? "victoire" : "défaite"}
        {form.streak.length > 1 ? "s" : ""} d&apos;affilée.
      </p>
      {team.home && team.away ? (
        <p>
          À domicile : {team.home.wins}-{team.home.losses} · À l&apos;extérieur : {team.away.wins}-{team.away.losses}
        </p>
      ) : null}
      {team.earlySeason ? <p className={styles.note}>Début de saison : peu de matchs joués, ces chiffres bougent vite.</p> : null}
      {team.keyPlayers.length > 0 ? <PlayersTable players={team.keyPlayers} caption="Joueurs à surveiller" /> : null}
      {team.roster.length > 0 ? <PlayersTable players={team.roster} caption="Effectif complet" /> : null}
    </section>
  );
}

export function TeamDetailsContent({ data }: { data: TeamInsightsResponse }) {
  const hasAnyData = data.teams.some((t) => t.form !== null);
  if (!hasAnyData) return <p>Pas encore de match joué cette saison.</p>;
  return (
    <>
      {data.teams.map((team) => (
        <TeamSection key={team.teamId} team={team} teamName={team.tricode} />
      ))}
      <p className={styles.note}>
        Joueurs ayant joué au moins un match cette saison, statistiques de saison régulière.
        {data.updatedAt ? ` Mis à jour le ${parisDateTimeLabel(data.updatedAt)}.` : ""}
      </p>
      <section className={styles.section}>
        <h3>Légende</h3>
        <dl className={styles.legend}>
          {STAT_LEGEND.map((l) => (
            <div key={l.abbr}>
              <dt>{l.abbr}</dt>
              <dd>{l.meaning}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
