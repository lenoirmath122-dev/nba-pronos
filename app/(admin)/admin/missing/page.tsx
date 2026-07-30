import { getAdminMissingData } from "@/lib/queries/admin-missing";
import styles from "./page.module.css";

// "Qui manque à l'appel" (BACKLOG_V1.md « Confort au quotidien ») — vue de
// LECTURE SEULE, en complément des rappels push automatiques (§2.46/§2.47) :
// aucune action câblée ici (pas de relance manuelle), juste la visibilité.
// Composant serveur, aucun "use client".

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function AdminMissingPage() {
  const data = await getAdminMissingData();

  const nothingToShow = data.matches.length === 0 && data.bracket === null;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Qui manque à l&apos;appel</h1>

      {!data.competitionId ? (
        <p className={styles.empty}>Aucune compétition en cours.</p>
      ) : nothingToShow ? (
        <p className={styles.empty}>
          Tout le monde est à jour sur les échéances des 3 prochains jours.
        </p>
      ) : (
        <div className={styles.blocks}>
          {data.bracket && (
            <section className={styles.block}>
              <h2 className={styles.blockTitle}>
                Bracket — deadline {formatDate(data.bracket.deadline)}
              </h2>
              <ul className={styles.pseudoList}>
                {data.bracket.missingPseudos.map((pseudo) => (
                  <li key={pseudo} className={styles.pseudo}>
                    {pseudo}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.matches.map((match) => (
            <section key={match.matchId} className={styles.block}>
              <h2 className={styles.blockTitle}>
                {match.awayTeam.abbreviation} @ {match.homeTeam.abbreviation} —{" "}
                {formatDate(match.scheduledAt)}
              </h2>
              <ul className={styles.pseudoList}>
                {match.missingPseudos.map((pseudo) => (
                  <li key={pseudo} className={styles.pseudo}>
                    {pseudo}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
