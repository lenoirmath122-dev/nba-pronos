import { getTeamOptions } from "@/lib/queries/admin-competitions";
import { createCompetitionFormAction } from "@/lib/actions/admin-competitions";
import styles from "./page.module.css";

// Création d'une compétition (SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1 §3) —
// lot 1/3. Composant serveur, aucun "use client" : les 2 jeux de champs
// (Playoffs / NBA Cup) vivent dans LE MÊME formulaire natif, celui non
// pertinent est simplement ignoré côté serveur selon le type soumis.

const ROUND1_SLOTS = [
  { key: "e1", label: "Est — Affiche 1" },
  { key: "e2", label: "Est — Affiche 2" },
  { key: "e3", label: "Est — Affiche 3" },
  { key: "e4", label: "Est — Affiche 4" },
  { key: "w1", label: "Ouest — Affiche 1" },
  { key: "w2", label: "Ouest — Affiche 2" },
  { key: "w3", label: "Ouest — Affiche 3" },
  { key: "w4", label: "Ouest — Affiche 4" },
] as const;

type SearchParams = { competitionError?: string };

export default async function NewCompetitionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const teams = await getTeamOptions();
  const eastTeams = teams.filter((t) => t.conference === "EAST");
  const westTeams = teams.filter((t) => t.conference === "WEST");

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Nouvelle compétition</h1>

      {sp.competitionError && (
        <p className={styles.error} role="alert">
          {sp.competitionError}
        </p>
      )}

      <form action={createCompetitionFormAction} className={styles.form}>
        <label className={styles.field}>
          Nom
          <input type="text" name="name" required placeholder="ex. NBA Cup — Automne 2026" className={styles.input} />
        </label>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Type</legend>
          <label className={styles.radioLabel}>
            <input type="radio" name="type" value="PLAYOFFS" defaultChecked /> Playoffs
          </label>
          <label className={styles.radioLabel}>
            <input type="radio" name="type" value="NBA_CUP" /> NBA Cup
          </label>
        </fieldset>

        <div className={styles.playoffsSection}>
          <p className={styles.sectionNote}>
            Affiches du 1er tour — utilisées uniquement si « Playoffs » est sélectionné ci-dessus.
          </p>
          {ROUND1_SLOTS.map((slot) => {
            const options = slot.key.startsWith("e") ? eastTeams : westTeams;
            return (
              <div key={slot.key} className={styles.matchup}>
                <span className={styles.matchupLabel}>{slot.label}</span>
                <select name={`matchup_${slot.key}_a`} className={styles.select} defaultValue="">
                  <option value="" disabled>
                    Équipe A…
                  </option>
                  {options.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.abbreviation} — {team.name}
                    </option>
                  ))}
                </select>
                <select name={`matchup_${slot.key}_b`} className={styles.select} defaultValue="">
                  <option value="" disabled>
                    Équipe B…
                  </option>
                  {options.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.abbreviation} — {team.name}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        <button type="submit" className={styles.submit}>
          Créer la compétition
        </button>
      </form>
    </div>
  );
}
