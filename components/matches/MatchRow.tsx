"use client";

import { useEffect, useState } from "react";
import type { MatchCard } from "@/lib/queries/matches";
import { PredictionForm } from "./PredictionForm";
import styles from "./MatchRow.module.css";

// Ligne de match — feuille client n°1/3 (§1) : porte son PROPRE booléen
// d'ouverture. Avec la multi-ouverture (§3), plusieurs MatchRow peuvent être
// ouvertes en même temps ; aucun état ne remonte à un parent (MatchDayGroup
// et la page restent serveur). État d'ouverture non persisté (ni
// sessionStorage, ni URL, §3).

const ONE_HOUR_MS = 60 * 60 * 1000;

const STATUS_LABEL: Record<MatchCard["viewStatus"], string> = {
  TODO: "à faire",
  INCOMPLETE: "incomplet",
  READY: "prêt",
  VALIDATED: "validé",
};

const STATUS_CLASS: Record<MatchCard["viewStatus"], string> = {
  TODO: styles.statusTodo,
  INCOMPLETE: styles.statusIncomplete,
  READY: styles.statusReady,
  VALIDATED: styles.statusValidated,
};

function formatLockLabel(scheduledAt: string, nowMs: number): string {
  const remainingMs = Math.max(0, Date.parse(scheduledAt) - nowMs);
  const totalMinutes = Math.floor(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `verrou dans ${minutes} min`;
  return `verrou dans ${hours} h ${String(minutes).padStart(2, "0")}`;
}

function formatLiveLockLabel(scheduledAt: string, nowMs: number): string {
  const remainingMs = Math.max(0, Date.parse(scheduledAt) - nowMs);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `verrou dans ${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatKickoff(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function winnerAbbreviation(match: MatchCard): string | null {
  if (match.myWinnerTeamId === match.homeTeam.id) return match.homeTeam.abbreviation;
  if (match.myWinnerTeamId === match.awayTeam.id) return match.awayTeam.abbreviation;
  return null;
}

type MatchRowProps = { match: MatchCard };

export function MatchRow({ match }: MatchRowProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Repère TEXTUEL, pas un décompte vivant (§3.1) : calculé une seule fois au
  // montage, jamais pendant le rendu — même piège d'hydratation déjà rencontré
  // sur components/ui/Countdown.tsx (ETAT_ACTUEL §7). Premier rendu serveur et
  // premier rendu client sont donc identiques (state initial = null).
  const [lockLabel, setLockLabel] = useState<string | null>(null);
  useEffect(() => {
    function computeOnce() {
      setLockLabel(formatLockLabel(match.scheduledAt, Date.now()));
    }
    computeOnce();
  }, [match.scheduledAt]);

  // Décompte ANIMÉ — réservé à la ligne dépliée (§3.1/§11) : ne tourne que
  // pendant que isOpen est vrai, s'arrête net à la fermeture.
  const [liveLockLabel, setLiveLockLabel] = useState<string | null>(null);
  useEffect(() => {
    function reset() {
      setLiveLockLabel(null);
    }
    if (!isOpen) {
      reset();
      return;
    }
    let timeoutId: ReturnType<typeof setTimeout>;
    function tick() {
      const remainingMs = Date.parse(match.scheduledAt) - Date.now();
      if (remainingMs <= ONE_HOUR_MS) {
        setLiveLockLabel(formatLiveLockLabel(match.scheduledAt, Date.now()));
        timeoutId = setTimeout(tick, 1000);
      } else {
        setLiveLockLabel(formatLockLabel(match.scheduledAt, Date.now()));
        timeoutId = setTimeout(tick, 30_000);
      }
    }
    tick();
    return () => clearTimeout(timeoutId);
  }, [isOpen, match.scheduledAt]);

  const recap = match.viewStatus === "VALIDATED" ? winnerAbbreviation(match) : null;

  return (
    <div className={styles.row}>
      <button type="button" className={styles.header} onClick={() => setIsOpen((v) => !v)} aria-expanded={isOpen}>
        <span className={styles.teams}>
          {match.homeTeam.abbreviation} – {match.awayTeam.abbreviation}
        </span>
        <span className={styles.meta}>
          <span className={styles.time}>{formatKickoff(match.scheduledAt)}</span>
          <span className={styles.lock}>{isOpen ? liveLockLabel : lockLabel}</span>
        </span>
        <span className={`${styles.status} ${STATUS_CLASS[match.viewStatus]}`}>
          {recap !== null ? `✓ ${recap} −${match.myMargin}` : STATUS_LABEL[match.viewStatus]}
        </span>
        <span className={isOpen ? styles.chevronOpen : styles.chevron} aria-hidden="true">
          ▾
        </span>
      </button>
      {isOpen && <PredictionForm match={match} />}
    </div>
  );
}
