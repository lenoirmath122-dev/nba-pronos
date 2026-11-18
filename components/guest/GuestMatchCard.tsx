import Link from "next/link";
import { dayTimeLabel } from "@/lib/publicHome/labels";
import type { GuestMatch, GuestTeam } from "@/lib/guest/query";
import styles from "./guest.module.css";

function Team({ team }: { team: GuestTeam }) {
  return (
    <span className={styles.team}>
      {team.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo d'équipe de taille fixe
        <img src={team.logoUrl} alt="" width={28} height={28} className={styles.logo} />
      ) : null}
      {team.name}
    </span>
  );
}

/** Carte d'un match (liste invité) : renvoie vers la page publique du match. */
export function GuestMatchCard({ match, nowMs }: { match: GuestMatch; nowMs: number }) {
  const finished = match.status === "FINISHED" && match.homeScore !== null && match.awayScore !== null;
  return (
    <li>
      <Link href={`/match/${match.id}`} className={`${styles.card} glass-card`}>
        <span className={styles.when}>
          {match.status === "IN_PROGRESS" ? "En cours" : dayTimeLabel(match.scheduledAt, nowMs)}
        </span>
        <span className={styles.teams}>
          <Team team={match.home} />
          {finished ? <span className={styles.score}>{match.homeScore}</span> : null}
        </span>
        <span className={styles.teams}>
          <Team team={match.away} />
          {finished ? <span className={styles.score}>{match.awayScore}</span> : null}
        </span>
      </Link>
    </li>
  );
}
