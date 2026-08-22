"use client";

import { useEffect, useRef, useState } from "react";
import type { UpcomingMatchRow as UpcomingMatchRowData } from "@/lib/queries/play";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { UpcomingRowForm } from "./UpcomingRowForm";
import styles from "./UpcomingRow.module.css";

// Ligne de match pas encore verrouillé — ex-components/matches/MatchRow.tsx.
// Feuille client : porte son PROPRE booléen d'ouverture. Plusieurs lignes
// peuvent être ouvertes en même temps ; aucun état ne remonte à un parent
// (MatchDayGroup et la page restent serveur). État d'ouverture non persisté.
//
// En-tête équipes alignée sur LockedRow.tsx (logo + abréviations, neutre) —
// avant le 19/08/2026, ce composant avait son PROPRE style de chip coloré en
// dégradé par équipe (logo en filigrane à peine visible), redondant avec le
// vrai logo affiché juste en dessous par TeamPicker une fois la ligne
// ouverte (doublon signalé par l'utilisateur).

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

  // Vainqueur : levé ici (plutôt que dans UpcomingRowForm) pour que les
  // boutons logo de l'en-tête, TOUJOURS montés, puissent le modifier — un
  // tap choisit ET déplie en une seule action (fusion avec l'ex-TeamPicker).
  // Remis à match.myWinnerTeamId à la FERMETURE (handleToggle, pas un effet
  // — react-hooks/set-state-in-effect, déjà rencontré §2.89 ETAT_ACTUEL) :
  // même garantie qu'avant le levage, quand UpcomingRowForm se démontait
  // avec son propre état local et perdait le brouillon non enregistré.
  const [winner, setWinner] = useState<string | null>(match.myWinnerTeamId);

  const isReadOnly = match.viewStatus === "VALIDATED";

  // Repli automatique demandé par l'utilisateur le 21/08/2026 (libérer la
  // vue après validation) : se déclenche UNE FOIS, au moment précis où le
  // statut bascule sur VALIDATED pendant que la ligne est ouverte -- jamais
  // en repliant de force une ligne déjà validée qu'on rouvre ensuite pour
  // consulter le récap (isReadOnly reste consultable via handleToggle
  // normal). previousStatus en ref plutôt qu'en dépendance d'effet : on ne
  // veut réagir qu'à la TRANSITION, pas rejouer à chaque re-render une fois
  // déjà VALIDATED.
  const previousStatusRef = useRef(match.viewStatus);
  useEffect(() => {
    if (previousStatusRef.current !== "VALIDATED" && match.viewStatus === "VALIDATED") {
      setIsOpen(false);
    }
    previousStatusRef.current = match.viewStatus;
  }, [match.viewStatus]);

  function handleSelectTeam(teamId: string) {
    if (isReadOnly) return;
    setWinner(teamId);
    setIsOpen(true);
  }

  function handleToggle() {
    setIsOpen((wasOpen) => {
      if (!wasOpen) return true;
      setWinner(match.myWinnerTeamId);
      return false;
    });
  }

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
      <div className={styles.header}>
        <div className={styles.teams}>
          {[match.homeTeam, match.awayTeam].map((team) => (
            <button
              key={team.id}
              type="button"
              className={winner === team.id ? `${styles.teamButton} ${styles.teamButtonSelected}` : styles.teamButton}
              onClick={() => handleSelectTeam(team.id)}
              disabled={isReadOnly}
              aria-pressed={winner === team.id}
              aria-label={team.name}
            >
              <TeamLogo abbreviation={team.abbreviation} alt={team.name} size={32} />
              {team.abbreviation}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.metaToggle}
          onClick={handleToggle}
          aria-expanded={isOpen}
          aria-label="Détails du match"
        >
          <span className={styles.meta}>
            <span className={styles.time}>{formatKickoff(match.scheduledAt)}</span>
            <span className={styles.lock}>{isOpen ? liveLockLabel : lockLabel}</span>
          </span>
          <span className={styles.metaRight}>
            <span className={`${styles.status} ${STATUS_CLASS[match.viewStatus]}`}>
              {/* "+" pas "−" (22/08/2026, signalé par l'utilisateur --
                  "CHI −4" se lisait comme un ecart negatif alors que
                  myMargin est toujours l'ecart de victoire du vainqueur
                  choisi). */}
              {recap !== null ? `✓ ${recap} +${match.myMargin}` : STATUS_LABEL[match.viewStatus]}
            </span>
            <span className={isOpen ? styles.chevronOpen : styles.chevron} aria-hidden="true">
              ▾
            </span>
          </span>
        </button>
      </div>
      {isOpen && <UpcomingRowForm match={match} winner={winner} />}
    </div>
  );
}
