import Link from "next/link";
import { buildResultsPath } from "./urls";
import styles from "./FilterBar.module.css";

// Filtre par série de l'onglet Résultats — formulaire GET natif, aucun
// JavaScript. Le filtre par date a déménagé dans DateStrip.tsx (18/08/2026,
// demandé par l'utilisateur — bandeau de dates défilant plutôt qu'un
// <input type="date">) : les deux filtres sont désormais INDÉPENDANTS,
// chacun préserve l'autre via un champ caché plutôt que de tout remplacer.

type FilterBarProps = {
  availableSeries: { id: string; label: string }[];
  seriesId: string | null;
  date: string | null;
  leagueId?: string | null;
};

export function FilterBar({ availableSeries, seriesId, date, leagueId }: FilterBarProps) {
  const activeSeriesLabel = seriesId ? availableSeries.find((s) => s.id === seriesId)?.label : null;

  return (
    <div className={styles.wrap}>
      {activeSeriesLabel && (
        <Link href={buildResultsPath({ date, leagueId })} className={styles.chip}>
          Filtre : {activeSeriesLabel} ✕
        </Link>
      )}

      <form action="/play/results" method="get" className={styles.form}>
        {leagueId && <input type="hidden" name="ligue" value={leagueId} />}
        {date && <input type="hidden" name="date" value={date} />}
        <label className={styles.field}>
          Série
          <select name="series" defaultValue={seriesId ?? ""}>
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
