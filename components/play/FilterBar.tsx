import Link from "next/link";
import { buildResultsPath } from "./urls";
import styles from "./FilterBar.module.css";

// Filtres date/série de l'onglet Résultats — formulaire GET natif, aucun
// JavaScript. Les valeurs proposées (availableDates/availableSeries) viennent
// de lib/queries/play.ts, jamais inventées au rendu. Ex-components/
// my-predictions/FilterBar.tsx — la bascule Récent/Historique a disparu (elle
// EST désormais la bascule d'onglet Mes pronos/Résultats), donc plus de
// notion de "mode" à préserver ici : un filtre actif n'a plus qu'un seul état
// à remplacer.

function formatDateChip(dateStr: string): string {
  const atNoonUtc = new Date(`${dateStr}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" }).format(
    atNoonUtc
  );
}

type FilterBarProps = {
  availableDates: string[];
  availableSeries: { id: string; label: string }[];
  filter: { date: string | null; seriesId: string | null };
  leagueId?: string | null;
};

export function FilterBar({ availableDates, availableSeries, filter, leagueId }: FilterBarProps) {
  const activeSeriesLabel = filter.seriesId ? availableSeries.find((s) => s.id === filter.seriesId)?.label : null;
  const chipLabel = filter.date ? formatDateChip(filter.date) : activeSeriesLabel;

  return (
    <div className={styles.wrap}>
      {chipLabel && (
        <Link href={buildResultsPath({ leagueId })} className={styles.chip}>
          Filtre : {chipLabel} ✕
        </Link>
      )}

      <form action="/play/results" method="get" className={styles.form}>
        {leagueId && <input type="hidden" name="ligue" value={leagueId} />}
        <label className={styles.field}>
          Date
          <input type="date" name="date" defaultValue={filter.date ?? ""} list="play-results-available-dates" />
        </label>
        <datalist id="play-results-available-dates">
          {availableDates.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>

        <label className={styles.field}>
          Série
          <select name="series" defaultValue={filter.seriesId ?? ""}>
            <option value="">Toutes</option>
            {availableSeries.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className={styles.submit}>
          Filtrer
        </button>
      </form>
    </div>
  );
}
