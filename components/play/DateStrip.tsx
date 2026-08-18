"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { buildResultsPath } from "./urls";
import styles from "./DateStrip.module.css";

// Filtre par date en bandeau horizontal défilant — demandé par l'utilisateur
// (18/08/2026) « qui ressemble à celui de MPP » : une pastille par jour,
// ancienne à gauche, récente à droite, clic = filtre sur ce jour. Remplace
// l'ancien <input type="date"> de FilterBar pour la date (la série reste un
// <select>, non concernée par cette demande).
//
// `availableDates` (lib/queries/play.ts) est trié DESCENDANT (plus récent
// d'abord — convention historique héritée de l'ex-écran Mes pronos, où la
// liste elle-même se lit anti-chronologique). Cet écran-ci veut l'inverse
// (ancien -> récent, de gauche à droite) : trié ICI, localement, plutôt que
// de changer l'ordre en amont et risquer de casser un autre usage futur.
//
// "use client" UNIQUEMENT pour le défilement automatique au chargement
// (18/08/2026, demandé par l'utilisateur — « qu'on arrive sur l'onglet à la
// date du jour ») : les pastilles restent de vrais <Link>, navigables sans
// JS. Une seule fois au montage (même patron que le guidage automatique du
// poster de remplissage, FillPosterView.tsx) : scrolle vers la pastille
// ACTIVE si une date est filtrée, sinon vers la plus RÉCENTE (bord droit) —
// Résultats ne contenant jamais "aujourd'hui" (fenêtre > 3 jours), le bord
// droit en est l'équivalent le plus proche.

function formatDayChip(dateStr: string): { weekday: string; dayMonth: string } {
  const atNoonUtc = new Date(`${dateStr}T12:00:00.000Z`);
  const weekday = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "short" }).format(atNoonUtc);
  const dayMonth = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit" }).format(atNoonUtc);
  return { weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1).replace(".", ""), dayMonth };
}

type DateStripProps = {
  dates: string[];
  activeDate: string | null;
  seriesId: string | null;
  leagueId?: string | null;
};

// Changer de date réinitialise volontairement la pagination (`limit`) —
// même comportement que l'ancienne puce "Filtre : X ✕" qu'elle remplace.
export function DateStrip({ dates, activeDate, seriesId, leagueId }: DateStripProps) {
  const scrollTargetRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // Bug trouvé par l'utilisateur (18/08/2026) : un lien du feed Accueil
    // vers `/play/results#match-XXX` arrivait bien sur la bonne page, mais
    // PAS sur la bonne ligne — ce défilement-ci (déclenché au même montage
    // que le défilement natif du navigateur vers l'ancre) le reprenait de
    // force vers le bandeau de dates, tout en haut. Une ancre déjà présente
    // dans l'URL a toujours priorité : rien à faire ici dans ce cas.
    if (window.location.hash) return;
    scrollTargetRef.current?.scrollIntoView({ inline: activeDate ? "center" : "end", block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois au montage, jamais au re-rendu
  }, []);

  if (dates.length === 0) return null;

  const ascending = [...dates].sort((a, b) => (a < b ? -1 : 1));
  const mostRecentDate = ascending[ascending.length - 1];

  return (
    <nav className={styles.strip} aria-label="Filtrer par date">
      <Link
        href={buildResultsPath({ seriesId, leagueId })}
        className={activeDate === null ? `${styles.chip} ${styles.chipActive}` : styles.chip}
        aria-current={activeDate === null ? "page" : undefined}
      >
        <span className={styles.all}>Tous</span>
      </Link>
      {ascending.map((date) => {
        const { weekday, dayMonth } = formatDayChip(date);
        const isActive = date === activeDate;
        // Cible de défilement : la pastille active si une date est filtrée,
        // sinon la plus récente (bord droit) — jamais "Tous" (bord gauche),
        // qui n'aurait rien de plus intéressant à révéler en défilant.
        const isScrollTarget = isActive || (activeDate === null && date === mostRecentDate);
        return (
          <Link
            key={date}
            href={buildResultsPath({ date, seriesId, leagueId })}
            ref={isScrollTarget ? scrollTargetRef : undefined}
            className={isActive ? `${styles.chip} ${styles.chipActive}` : styles.chip}
            aria-current={isActive ? "page" : undefined}
          >
            <span className={styles.weekday}>{weekday}</span>
            <span className={styles.dayMonth}>{dayMonth}</span>
          </Link>
        );
      })}
    </nav>
  );
}
