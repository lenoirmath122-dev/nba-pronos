import Link from "next/link";
import { buildViewPath } from "./urls";
import styles from "./FilterBar.module.css";

// Filtres date/série (§4.2) — formulaire GET natif, aucun JavaScript, aucun
// composant client. Les valeurs proposées (availableDates/availableSeries)
// viennent de lib/queries/my-predictions.ts, jamais inventées au rendu.
// Quand un filtre est actif, il REMPLACE la segmentation (§4.3) : la page
// n'affiche alors plus SegmentTabs, seulement la puce ci-dessous.

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
        <Link href={buildViewPath({ mode: "RECENT", leagueId })} className={styles.chip}>
          Filtre : {chipLabel} ✕
        </Link>
      )}

      <form action="/play/my-predictions" method="get" className={styles.form}>
        {/* Portée ligue (30/07/2026) : préservée à travers un submit natif,
            qui remplace sinon TOUTE la query string par les seuls champs
            nommés de ce formulaire. */}
        {leagueId && <input type="hidden" name="ligue" value={leagueId} />}
        <label className={styles.field}>
          Date
          <input type="date" name="date" defaultValue={filter.date ?? ""} list="my-predictions-available-dates" />
        </label>
        <datalist id="my-predictions-available-dates">
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
