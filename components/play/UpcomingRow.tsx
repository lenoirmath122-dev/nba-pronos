"use client";

import { useEffect, useState } from "react";
import type { UpcomingMatchRow as UpcomingMatchRowData } from "@/lib/queries/play";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { useValidatedDialog } from "@/components/ui/ValidatedDialog";
import { formatPronoRecap } from "@/lib/labels/pronos";
import { useSuccessFlash } from "@/lib/hooks/useSuccessFlash";
import flashStyles from "@/components/ui/SuccessFlash.module.css";
import { MarginStepper } from "./MarginStepper";
import { PronoBug } from "./PronoBug";
import { ParticipationTrigger } from "./ParticipationTrigger";
import { MatchAffiche } from "./MatchAffiche";
import { MatchBetZone } from "./MatchBetZone";
import { OthersOnMatch } from "./OthersOnMatch";
import { useMatchPronoForm, type ValidatedPick } from "./useMatchPronoForm";
import { PendingLabel, ValidateConfirmDialog } from "./ValidateConfirmDialog";
import styles from "./UpcomingRow.module.css";

// Ligne de match pas encore verrouillé — ex-components/matches/MatchRow.tsx,
// puis fusionné le 19/08/2026 avec l'ex-TeamPicker (sélection du vainqueur
// sur les boutons logo) et le 14/09/2026 avec l'ex-UpcomingRowForm.tsx : le
// dépliage/repliage (isOpen) a été entièrement supprimé à la demande de
// l'utilisateur — la carte affiche TOUJOURS son contenu complet (équipes +
// icônes pari/participation, actions brouillon/valider, méta), il n'y a plus
// de raison de garder deux composants séparés dont l'un n'existait que pour
// être monté/démonté à la demande.
//
// Ordre vertical de la carte (22/10/2026) : heure (+ affiche du match si prono
// validé) → équipes + icône participation, ou bande « Mon prono » si validé →
// actions brouillon/valider → zone « Mon pari » (MatchBetZone).

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
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  // Unité la plus grande, puis la suivante seulement si elle n'est pas nulle
  // (demandé par l'utilisateur, 31/08/2026) : jamais plus de 2 niveaux (donc
  // jamais de minutes affichées une fois qu'on est passé en jours).
  if (days > 0) {
    return hours === 0 ? `dans ${days} j` : `dans ${days} j ${hours} h`;
  }
  if (hours > 0) {
    return minutes === 0 ? `dans ${hours} h` : `dans ${hours} h ${String(minutes).padStart(2, "0")}`;
  }
  return `dans ${minutes} min`;
}

function formatLiveLockLabel(scheduledAt: string, nowMs: number): string {
  const remainingMs = Math.max(0, Date.parse(scheduledAt) - nowMs);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `dans ${minutes}:${String(seconds).padStart(2, "0")}`;
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

type UpcomingRowProps = { match: UpcomingMatchRowData; maxBetPoints: number };

export function UpcomingRow({ match, maxBetPoints }: UpcomingRowProps) {
  const [othersOpen, setOthersOpen] = useState(false);
  const showValidated = useValidatedDialog();
  const [flashing, flash] = useSuccessFlash();

  // Popup « Prono validé » (04/10/2026) à la place du toast : elle rappelle
  // le prono qui vient d'être figé, pas seulement le fait qu'il l'a été.
  function showValidatedProno({ winnerTeamId, margin: pickedMargin }: ValidatedPick) {
    const isHomeWinner = winnerTeamId === match.homeTeam.id;
    const winnerTeam = isHomeWinner ? match.homeTeam : match.awayTeam;
    const loserTeam = isHomeWinner ? match.awayTeam : match.homeTeam;
    showValidated({
      title: "Prono validé",
      items: [formatPronoRecap(winnerTeam.abbreviation, loserTeam.abbreviation, pickedMargin)],
    });
  }

  // Vainqueur ET écart : la carte n'ayant plus d'état ouvert/fermé, ces deux
  // valeurs vivent directement dans le formulaire, en permanence — un tap sur
  // une équipe la sélectionne, le stepper "−"/"+" apparaît à côté de son nom.
  const {
    winner,
    margin,
    setMargin,
    selectTeam: handleSelectTeam,
    isReadOnly,
    isComplete,
    isUnsaved,
    isPending,
    pendingAction,
    error,
    showValidateConfirm,
    setShowValidateConfirm,
    saveDraft: handleSaveDraft,
    validate: handleValidate,
    validateDefinitively: handleValidateDefinitively,
  } = useMatchPronoForm(match, (pick) => {
    showValidatedProno(pick);
    flash();
  });

  // Repère de verrouillage — ticking en permanence désormais (plus de ligne
  // "repliée" à économiser depuis la suppression du dépliage) : label grossier
  // tant qu'il reste plus d'une heure, décompte seconde par seconde ensuite.
  const [lockLabel, setLockLabel] = useState<string | null>(null);
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    function tick() {
      const remainingMs = Date.parse(match.scheduledAt) - Date.now();
      if (remainingMs <= ONE_HOUR_MS) {
        setLockLabel(formatLiveLockLabel(match.scheduledAt, Date.now()));
        timeoutId = setTimeout(tick, 1000);
      } else {
        setLockLabel(formatLockLabel(match.scheduledAt, Date.now()));
        timeoutId = setTimeout(tick, 30_000);
      }
    }
    tick();
    return () => clearTimeout(timeoutId);
  }, [match.scheduledAt]);

  const recap = match.viewStatus === "VALIDATED" ? winnerAbbreviation(match) : null;
  const validatedPick =
    recap !== null && match.myMargin !== null ? { abbreviation: recap, margin: match.myMargin } : null;

  // Seule raison de fermeture possible sur une carte à venir : quota de 3
  // paris atteint sur la série (Playoffs). Un coup d'envoi qui passe pendant
  // que la carte est ouverte est refusé par le serveur (erreur sous le champ).
  const quotaReached =
    match.betSlot.mode === "SERIES_QUOTA" &&
    !match.betSlot.hasBetOnThisMatch &&
    match.betSlot.usedSlots >= match.betSlot.totalSlots;
  const shortTeamName = match.homeTeam.name.split(" ").at(-1) ?? match.homeTeam.name;

  const participation = (
    <ParticipationTrigger
      isRevealed={match.isRevealed}
      predictedCount={match.predictedCount}
      eligibleCount={match.eligibleCount}
      others={match.others}
      absentees={match.absentees}
    />
  );

  return (
    <div id={`match-${match.matchId}`} className={`${styles.row} glass-card${flashing ? ` ${flashStyles.flash}` : ""}`}>
      <div className={styles.header}>
        <div className={styles.kickoffRow}>
          {/* Match du jour : jour NY (celui du tirage) + heure de Paris, avec
              « dans la nuit du … au … » quand le coup d'envoi passe minuit à
              Paris. Sinon heure seule + compte à rebours (ex-rangée méta,
              remplacée par la zone Mon pari). */}
          <time dateTime={match.scheduledAt} className={styles.dailyKickoff}>
            <span className={styles.dailyTitle}>
              {match.daily ? match.daily.time : formatKickoff(match.scheduledAt)}
            </span>
            <span className={styles.dailyNight}>
              {[match.daily?.nightLabel, lockLabel && `(${lockLabel})`].filter(Boolean).join(" ")}
            </span>
          </time>
          {validatedPick ? (
            <MatchAffiche home={match.homeTeam} away={match.awayTeam} />
          ) : (
            (match.viewStatus === "INCOMPLETE" || match.viewStatus === "READY") && (
              <span className={`${styles.status} ${STATUS_CLASS[match.viewStatus]}`}>
                {STATUS_LABEL[match.viewStatus]}
              </span>
            )
          )}
        </div>

        {validatedPick ? (
          // Prono validé (non modifiable, isReadOnly) : la bande « Mon prono »
          // prend la place des boutons d'équipe, l'icône « personnes » reste à
          // sa droite.
          <div className={styles.pronoRow}>
            <div className={styles.pronoBand}>
              <PronoBug pick={validatedPick} />
            </div>
            {participation}
          </div>
        ) : (
          <div className={styles.topRow}>
            {/* Grille à 2 colonnes (équipe / équipe) — 16/09/2026 : le stepper
                de l'équipe sélectionnée vit sur sa propre rangée, sous les 2
                boutons, centré entre eux. */}
            <div className={styles.teams}>
              {[match.homeTeam, match.awayTeam].map((team) => (
                <button
                  key={team.id}
                  type="button"
                  className={
                    winner === team.id ? `${styles.teamButton} ${styles.teamButtonSelected}` : styles.teamButton
                  }
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

            <div className={styles.iconColumn}>{participation}</div>

            {winner !== null && !isReadOnly && (
              <div className={styles.stepperRow}>
                <MarginStepper value={margin} onChange={setMargin} />
              </div>
            )}
          </div>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {/* Brouillon/Valider n'apparaissent qu'une fois un vainqueur choisi
            (14/09/2026, à la demande de l'utilisateur), côte à côte. */}
        {winner !== null && !isReadOnly && (
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={handleSaveDraft} disabled={isPending}>
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

        <MatchBetZone
          matchId={match.matchId}
          seriesId={match.seriesId}
          bet={match.bet}
          closedMessage={quotaReached ? "Quota de paris atteint pour cette série." : null}
          placeholderTeam={shortTeamName}
          maxPoints={maxBetPoints}
          onViewOthers={() => setOthersOpen(true)}
        />
      </div>

      <OthersOnMatch
        open={othersOpen}
        onClose={() => setOthersOpen(false)}
        mode="upcoming"
        isRevealed={match.isRevealed}
        predictedCount={match.predictedCount}
        eligibleCount={match.eligibleCount}
        others={match.others}
        absentees={match.absentees}
        betsWithoutProno={match.betsWithoutProno}
      />

      {showValidateConfirm && (
        <ValidateConfirmDialog
          matchId={match.matchId}
          isUnsaved={isUnsaved}
          isPending={isPending}
          pendingAction={pendingAction}
          onClose={() => setShowValidateConfirm(false)}
          onSaveDraft={handleSaveDraft}
          onValidate={handleValidate}
          onValidateDefinitively={handleValidateDefinitively}
        />
      )}
    </div>
  );
}
