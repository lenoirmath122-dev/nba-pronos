"use client";

import { useEffect, useState } from "react";
import type { BetSlotIndicator, UpcomingMatchRow as UpcomingMatchRowData } from "@/lib/queries/play";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { InlineBetForm } from "@/components/bets/InlineBetForm";
import { useValidatedDialog } from "@/components/ui/ValidatedDialog";
import { formatPronoRecap } from "@/lib/labels/pronos";
import { useSuccessFlash } from "@/lib/hooks/useSuccessFlash";
import flashStyles from "@/components/ui/SuccessFlash.module.css";
import { MarginStepper } from "./MarginStepper";
import { PronoBug } from "./PronoBug";
import { ParticipationTrigger } from "./ParticipationTrigger";
import { ViewBetTrigger } from "./ViewBetTrigger";
import { remainingBets, toInlineBetOwned } from "./betSlot";
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
// Ordre vertical de la carte (imposé par l'utilisateur, 14/09/2026) :
// équipes (+ stepper d'écart à côté du nom, + colonne icônes pari/
// participation en haut à droite) → actions brouillon/valider (seulement si
// un vainqueur est choisi) → bloc pari en lecture seule si non éditable →
// rangée méta (heure, verrou, statut).

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

function triggerLabelFor(betSlot: BetSlotIndicator): string {
  return betSlot.mode === "BINARY" ? "Proposer un pari" : `Proposer un pari · ${betSlot.usedSlots}/${betSlot.totalSlots}`;
}

// Compteur affiché sous l'icône pari (14/09/2026), purement présentation.
function remainingBetsLabel(betSlot: BetSlotIndicator): string {
  const remaining = remainingBets(betSlot);
  return `${remaining} restant${remaining > 1 ? "s" : ""}`;
}

type UpcomingRowProps = { match: UpcomingMatchRowData };

export function UpcomingRow({ match }: UpcomingRowProps) {
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

  const myBet = toInlineBetOwned(match.bet);
  const readOnlyBet = match.bet && !myBet ? match.bet : null;
  const recap = match.viewStatus === "VALIDATED" ? winnerAbbreviation(match) : null;
  const validatedPick = recap !== null && match.myMargin !== null ? { abbreviation: recap, margin: match.myMargin } : null;

  return (
    <div
      id={`match-${match.matchId}`}
      className={`${styles.row} glass-card${flashing ? ` ${flashStyles.flash}` : ""}`}
    >
      <div className={styles.header}>
        {match.daily && (
          // Match du jour : jour NY (celui du tirage) + heure de Paris, avec
          // « dans la nuit du … au … » quand le coup d'envoi passe minuit à
          // Paris — cas quasi systématique, l'heure seule serait trompeuse.
          <time dateTime={match.scheduledAt} className={styles.dailyKickoff}>
            <span className={styles.dailyTitle}>
              {match.daily.time}
            </span>
            <span className={styles.dailyNight}>
              {[match.daily.nightLabel, lockLabel && `(${lockLabel})`].filter(Boolean).join(" ")}
            </span>
          </time>
        )}
        <div className={styles.topRow}>
          {/* Grille à 2 colonnes (équipe / équipe) — 16/09/2026, remplace la
              grille à 3 colonnes (équipe / zone stepper partagée / équipe) qui
              rétrécissait les boutons équipe (noms à l'étroit, signalé par
              l'utilisateur). Le stepper de l'équipe sélectionnée vit
              maintenant sur sa propre rangée, sous les 2 boutons. */}
          <div className={styles.teams}>
            <button
              type="button"
              className={
                winner === match.homeTeam.id ? `${styles.teamButton} ${styles.teamButtonSelected}` : styles.teamButton
              }
              onClick={() => handleSelectTeam(match.homeTeam.id)}
              disabled={isReadOnly}
              aria-pressed={winner === match.homeTeam.id}
              aria-label={match.homeTeam.name}
            >
              <TeamLogo abbreviation={match.homeTeam.abbreviation} alt={match.homeTeam.name} size={32} />
              {match.homeTeam.abbreviation}
            </button>

            <button
              type="button"
              className={
                winner === match.awayTeam.id ? `${styles.teamButton} ${styles.teamButtonSelected}` : styles.teamButton
              }
              onClick={() => handleSelectTeam(match.awayTeam.id)}
              disabled={isReadOnly}
              aria-pressed={winner === match.awayTeam.id}
              aria-label={match.awayTeam.name}
            >
              <TeamLogo abbreviation={match.awayTeam.abbreviation} alt={match.awayTeam.name} size={32} />
              {match.awayTeam.abbreviation}
            </button>
          </div>

          <div className={styles.iconColumn}>
            {/* Compteur de paris restants retiré du libellé visible
                (16/09/2026, demandé par l'utilisateur) : il reste accessible
                via aria-label et s'affichera dans la popup elle-même — ça
                libère de la hauteur pour agrandir les 2 boutons. */}
            {/* Le bouton pari reste TOUJOURS visible, même un pari déjà
                validé/refusé/résolu (16/09/2026, demandé par l'utilisateur) :
                ViewBetTrigger ouvre BetBlock en lecture seule dans une popup
                au lieu de l'afficher en plein cadre dans la carte -- la carte
                "de base" ne garde que équipes + prono. */}
            {readOnlyBet ? (
              <ViewBetTrigger bet={readOnlyBet} />
            ) : (
              <InlineBetForm
                scope="MATCH"
                matchId={match.matchId}
                seriesId={match.seriesId}
                hasBet={match.bet !== null}
                triggerLabel={triggerLabelFor(match.betSlot)}
                myBet={myBet}
                presentation="modal"
                compactTrigger
                remainingHint={remainingBetsLabel(match.betSlot)}
              />
            )}
            <ParticipationTrigger
              isRevealed={match.isRevealed}
              predictedCount={match.predictedCount}
              eligibleCount={match.eligibleCount}
              others={match.others}
              absentees={match.absentees}
            />
          </div>

          {/* Stepper d'écart sous la rangée équipes (16/09/2026, remplace la
              zone centrale partagée de la grille équipes qui rétrécissait les
              boutons — noms d'équipe à l'étroit, signalé par l'utilisateur).
              Placé dans la même grille que .teams/.iconColumn (pas en
              rangée pleine largeur sous topRow) pour être centré entre les 2
              boutons équipe, pas entre les bords de toute la carte — sinon
              la colonne icônes à droite décale visuellement le centre. */}
          {winner !== null && !isReadOnly && (
            <div className={styles.stepperRow}>
              <MarginStepper value={margin} onChange={setMargin} />
            </div>
          )}
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {/* Brouillon/Valider n'apparaissent qu'une fois un vainqueur choisi
            (14/09/2026, à la demande de l'utilisateur), côte à côte, entre la
            rangée équipes et la rangée méta. */}
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

        {/* Prono validé : bandeau télé pleine largeur partagé avec les cartes
            verrouillées (05/10/2026, p3-8), à la place de la pilule « ✓ BOS
            +3pts d'écart » de la rangée méta. Mention du pari verrouillé
            (15/09/2026, demandé par l'utilisateur) gardée dans le
            sous-bandeau : évite d'avoir à regarder la colonne icônes pour
            savoir si un pari perso existe encore. */}
        {validatedPick && (
          <PronoBug pick={validatedPick} detail={readOnlyBet ? "1 pari perso verrouillé" : undefined} />
        )}

        <div className={styles.metaRow}>
          <span className={styles.meta}>
            {!match.daily && <span className={styles.time}>{formatKickoff(match.scheduledAt)}</span>}
            {!match.daily && lockLabel && <span className={styles.lock}>({lockLabel})</span>}
          </span>
          {!validatedPick && match.viewStatus !== "TODO" && (
            <span className={`${styles.status} ${STATUS_CLASS[match.viewStatus]}`}>
              {STATUS_LABEL[match.viewStatus]}
            </span>
          )}
        </div>
      </div>

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
