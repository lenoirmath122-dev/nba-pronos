"use client";

import { useBoxScore } from "@/components/play/BoxScoreButton";
import { BoxScoreDialog } from "@/components/play/BoxScoreDialog";
import type { NightMatch } from "@/lib/recaps/build";
import styles from "./NightCard.module.css";

// Score de la nuit cliquable (Actualité, 13/11/2026, demandé par
// l'utilisateur) : ouvre la feuille de match du match, la même popup que sur
// l'onglet Résultats (JSON statique lu sur le CDN Supabase, BoxScoreButton).

function formatKickoff(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function NightScore({ match }: { match: NightMatch }) {
  const boxScore = useBoxScore(match.scheduledAt, match.homeAbbr, match.awayAbbr);
  return (
    <>
      <button
        type="button"
        className={styles.score}
        aria-haspopup="dialog"
        aria-label={`${match.label}, voir la feuille de match`}
        onClick={boxScore.open}
      >
        {match.label}
      </button>
      {boxScore.isOpen && (
        <BoxScoreDialog
          subtitle={`${match.homeAbbr} – ${match.awayAbbr} · ${formatKickoff(match.scheduledAt)}`}
          firstTricode={match.homeAbbr}
          state={boxScore.state}
          onRetry={boxScore.retry}
          onClose={boxScore.close}
        />
      )}
    </>
  );
}
