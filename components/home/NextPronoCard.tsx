"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { UpcomingMatchRow } from "@/lib/queries/play";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { formatPronoRecap } from "@/lib/labels/pronos";
import { MarginStepper } from "@/components/play/MarginStepper";
import { useMatchPronoForm, type ValidatedPick } from "@/components/play/useMatchPronoForm";
import { PendingLabel, ValidateConfirmDialog } from "@/components/play/ValidateConfirmDialog";
import styles from "./NextPronoCard.module.css";

// Carte « Prochain prono » de l'Accueil (22/10/2026) : le formulaire de
// prono de /play (vainqueur puis écart, mêmes server actions via
// useMatchPronoForm) pour le prochain match non validé, directement sur
// l'Accueil. Après une validation : retour « Prono enregistré ✓ » ~1 s, puis
// passage au match suivant. Les props viennent du serveur et se rafraîchissent
// toutes seules (les actions revalident /home : compteur de section et pastille
// Jouer de la nav suivent sans rechargement) ; `validatedIds` n'est qu'un
// garde-fou pour que la progression « 2/4 » ne dépende pas de l'instant exact
// où ces props arrivent.

const FEEDBACK_MS = 1000;
const CLOCK_TICK_MS = 15_000;

type Feedback = { recap: string };

type NextPronoCardProps = {
  /** Matchs à venir NON validés (brouillon compris), triés par coup d'envoi. */
  matches: UpcomingMatchRow[];
};

// Match du jour : même libellé que /play (jour NY, heure de Paris, puis
// « dans la nuit du … au … »), sinon la date de Paris trompe sur le jour.
function kickoffLabel(match: UpcomingMatchRow): string {
  const { daily } = match;
  if (!daily) return formatKickoff(match.scheduledAt);
  return `${daily.dayLabel} · ${daily.time}${daily.nightLabel ? ` (${daily.nightLabel})` : ""}`;
}

function formatKickoff(iso: string): string {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = part("weekday");
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${part("day")}/${part("month")} · ${part("hour")}:${part("minute")}`;
}

// Même découpage « unité la plus grande puis la suivante » que le repère de
// verrouillage de /play (UpcomingRow), version courte pour l'en-tête.
function formatRelative(iso: string, nowMs: number): string {
  const totalMinutes = Math.max(0, Math.floor((Date.parse(iso) - nowMs) / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return hours === 0 ? `dans ${days} j` : `dans ${days} j ${hours} h`;
  if (hours > 0) return minutes === 0 ? `dans ${hours} h` : `dans ${hours} h ${String(minutes).padStart(2, "0")}`;
  return `dans ${minutes} min`;
}

// Surface unique de la carte : même .glass-card que les autres sections de
// l'Accueil (aucun conteneur parent à poser autour).
function Surface({ children }: { children: React.ReactNode }) {
  return (
    <section className={`${styles.card} glass-card`} aria-label="Prochain prono">
      {children}
    </section>
  );
}

export function NextPronoCard({ matches }: NextPronoCardProps) {
  const [validatedIds, setValidatedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Horloge client uniquement (jamais au rendu serveur : pas de décalage
  // d'hydratation) — sert à l'affichage relatif ET à écarter un match qui
  // vient de se verrouiller pendant que la carte était ouverte.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    function tick() {
      setNowMs(Date.now());
      timeoutId = setTimeout(tick, CLOCK_TICK_MS);
    }
    tick();
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    },
    []
  );

  const available = matches.filter(
    (match) => !validatedIds.includes(match.matchId) && (nowMs === null || Date.parse(match.scheduledAt) > nowMs)
  );
  const current = available[0] ?? null;
  const position = validatedIds.length + 1;
  const total = validatedIds.length + available.length;

  function handleValidated(match: UpcomingMatchRow, pick: ValidatedPick) {
    const isHomeWinner = pick.winnerTeamId === match.homeTeam.id;
    const winnerTeam = isHomeWinner ? match.homeTeam : match.awayTeam;
    const loserTeam = isHomeWinner ? match.awayTeam : match.homeTeam;
    setValidatedIds((ids) => [...ids, match.matchId]);
    setFeedback({ recap: formatPronoRecap(winnerTeam.abbreviation, loserTeam.abbreviation, pick.margin) });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), FEEDBACK_MS);
  }

  if (feedback) {
    return (
      <Surface>
        <p className={styles.feedback} role="status">
          <span className={styles.feedbackTitle}>Prono enregistré ✓</span>
          <span className={styles.feedbackRecap}>{feedback.recap}</span>
        </p>
      </Surface>
    );
  }

  if (!current) {
    return (
      <Surface>
        <p className={styles.done} role="status">
          Tous tes pronos sont faits ✓
        </p>
        <Link href="/play" className={styles.link}>
          Voir mes pronos ›
        </Link>
      </Surface>
    );
  }

  return (
    <Surface>
      <NextPronoForm
        // Un formulaire neuf par match : vainqueur/écart/erreur repartent de zéro.
        key={current.matchId}
        match={current}
        position={position}
        total={total}
        nowMs={nowMs}
        onValidated={(pick) => handleValidated(current, pick)}
      />
      <Link href="/play" className={styles.link}>
        Voir tous mes pronos ›
      </Link>
    </Surface>
  );
}

type NextPronoFormProps = {
  match: UpcomingMatchRow;
  position: number;
  total: number;
  nowMs: number | null;
  onValidated: (pick: ValidatedPick) => void;
};

function NextPronoForm({ match, position, total, nowMs, onValidated }: NextPronoFormProps) {
  const {
    winner,
    margin,
    setMargin,
    selectTeam,
    isComplete,
    isUnsaved,
    isPending,
    pendingAction,
    error,
    showValidateConfirm,
    setShowValidateConfirm,
    saveDraft,
    validate,
    validateDefinitively,
  } = useMatchPronoForm(match, onValidated);

  const teams = [match.homeTeam, match.awayTeam];

  return (
    <>
      <div className={styles.head}>
        <span className={styles.kicker}>Prochain prono</span>
        <span className={styles.progress} aria-label={`Prono ${position} sur ${total}`}>
          {position}/{total}
        </span>
      </div>
      <p className={styles.question}>Qui gagne ?</p>
      <p className={styles.when}>
        <time dateTime={match.scheduledAt}>{kickoffLabel(match)}</time>
        {nowMs !== null && ` · ${formatRelative(match.scheduledAt, nowMs)}`}
      </p>

      <div className={styles.teams}>
        {teams.map((team) => (
          <button
            key={team.id}
            type="button"
            className={winner === team.id ? `${styles.teamButton} ${styles.teamButtonSelected}` : styles.teamButton}
            onClick={() => selectTeam(team.id)}
            aria-pressed={winner === team.id}
            aria-label={team.name}
          >
            <TeamLogo abbreviation={team.abbreviation} alt={team.name} size={32} />
            {team.abbreviation}
          </button>
        ))}
      </div>

      {winner !== null && (
        <div className={styles.stepperRow}>
          <MarginStepper value={margin} onChange={setMargin} />
        </div>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {winner !== null && (
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={saveDraft} disabled={isPending}>
            {isPending && pendingAction === "draft" && !showValidateConfirm ? (
              <PendingLabel label="Enregistrement…" />
            ) : (
              "Enregistrer le brouillon"
            )}
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => setShowValidateConfirm(true)}
            disabled={isPending || !isComplete}
          >
            Valider le prono
          </button>
        </div>
      )}

      {showValidateConfirm && (
        <ValidateConfirmDialog
          matchId={match.matchId}
          isUnsaved={isUnsaved}
          isPending={isPending}
          pendingAction={pendingAction}
          onClose={() => setShowValidateConfirm(false)}
          onSaveDraft={saveDraft}
          onValidate={validate}
          onValidateDefinitively={validateDefinitively}
        />
      )}
    </>
  );
}
