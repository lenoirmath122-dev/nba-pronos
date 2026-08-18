"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { UpcomingMatchRow as UpcomingMatchRowData } from "@/lib/queries/play";
import { TEAM_COLORS } from "@/lib/labels/teamColors";
import { UpcomingRowForm } from "./UpcomingRowForm";
import styles from "./UpcomingRow.module.css";

// Ligne de match pas encore verrouillé — ex-components/matches/MatchRow.tsx.
// Feuille client : porte son PROPRE booléen d'ouverture. Plusieurs lignes
// peuvent être ouvertes en même temps ; aucun état ne remonte à un parent
// (MatchDayGroup et la page restent serveur). État d'ouverture non persisté.

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function shade(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const adjust = (v: number) => Math.max(0, Math.min(255, Math.round(v + (amount > 0 ? 255 - v : v) * amount)));
  return `rgb(${adjust(r)}, ${adjust(g)}, ${adjust(b)})`;
}

function contrastTextColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 150 ? "#10141D" : "#F2F5FA";
}

function teamChipStyle(abbreviation: string): CSSProperties {
  const colors = TEAM_COLORS[abbreviation];
  if (!colors) return {};
  const { r, g, b } = hexToRgb(colors.secondary);
  return {
    color: contrastTextColor(colors.primary),
    "--team-primary": colors.primary,
    "--team-primary-light": shade(colors.primary, 0.24),
    "--team-primary-dark": shade(colors.primary, -0.3),
    "--team-secondary-tint": `rgba(${r}, ${g}, ${b}, 0.4)`,
    "--team-logo-url": `url(/logos/teams/${abbreviation}.svg)`,
  } as CSSProperties;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

const STATUS_LABEL: Record<UpcomingMatchRowData["viewStatus"], string> = {
  TODO: "à faire",
  INCOMPLETE: "incomplet",
  READY: "prêt",
  VALIDATED: "validé",
};

const STATUS_CLASS: Record<UpcomingMatchRowData["viewStatus"], string> = {
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

function winnerAbbreviation(match: UpcomingMatchRowData): string | null {
  if (match.myWinnerTeamId === match.homeTeam.id) return match.homeTeam.abbreviation;
  if (match.myWinnerTeamId === match.awayTeam.id) return match.awayTeam.abbreviation;
  return null;
}

type UpcomingRowProps = { match: UpcomingMatchRowData };

export function UpcomingRow({ match }: UpcomingRowProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Repère TEXTUEL, pas un décompte vivant : calculé une seule fois au
  // montage, jamais pendant le rendu (piège d'hydratation déjà rencontré sur
  // components/ui/Countdown.tsx).
  const [lockLabel, setLockLabel] = useState<string | null>(null);
  useEffect(() => {
    function computeOnce() {
      setLockLabel(formatLockLabel(match.scheduledAt, Date.now()));
    }
    computeOnce();
  }, [match.scheduledAt]);

  // Décompte ANIMÉ — réservé à la ligne dépliée : ne tourne que pendant que
  // isOpen est vrai, s'arrête net à la fermeture.
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
    <div id={`match-${match.matchId}`} className={`${styles.row} glass-card`}>
      <button type="button" className={styles.header} onClick={() => setIsOpen((v) => !v)} aria-expanded={isOpen}>
        <span className={styles.split}>
          <span className={styles.teamAbbr} style={teamChipStyle(match.homeTeam.abbreviation)}>
            <span className={styles.teamLabel}>
              {match.homeTeam.abbreviation}
              <span className={styles.srOnly}> contre </span>
            </span>
          </span>
          <span className={styles.divider} aria-hidden="true" />
          <span className={styles.teamAbbr} style={teamChipStyle(match.awayTeam.abbreviation)}>
            <span className={styles.teamLabel}>{match.awayTeam.abbreviation}</span>
          </span>
        </span>
        <span className={styles.metaRow}>
          <span className={styles.meta}>
            <span className={styles.time}>{formatKickoff(match.scheduledAt)}</span>
            <span className={styles.lock}>{isOpen ? liveLockLabel : lockLabel}</span>
          </span>
          <span className={styles.metaRight}>
            <span className={`${styles.status} ${STATUS_CLASS[match.viewStatus]}`}>
              {recap !== null ? `✓ ${recap} −${match.myMargin}` : STATUS_LABEL[match.viewStatus]}
            </span>
            <span className={isOpen ? styles.chevronOpen : styles.chevron} aria-hidden="true">
              ▾
            </span>
          </span>
        </span>
      </button>
      {isOpen && <UpcomingRowForm match={match} />}
    </div>
  );
}
