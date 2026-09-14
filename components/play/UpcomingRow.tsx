"use client";

import { useEffect, useState, useTransition } from "react";
import { useUnsavedGuard } from "@/lib/hooks/useUnsavedGuard";
import { saveMatchPredictionDraft, validateMatchPrediction } from "@/lib/actions/matches";
import type { BetSlotIndicator, UpcomingMatchRow as UpcomingMatchRowData } from "@/lib/queries/play";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { InlineBetForm, type InlineBetOwned } from "@/components/bets/InlineBetForm";
import { FocusTrap } from "@/components/ui/FocusTrap";
import { MarginStepper } from "./MarginStepper";
import { ParticipationTrigger } from "./ParticipationTrigger";
import { ViewBetTrigger } from "./ViewBetTrigger";
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
    return hours === 0 ? `verrou dans ${days} j` : `verrou dans ${days} j ${hours} h`;
  }
  if (hours > 0) {
    return minutes === 0 ? `verrou dans ${hours} h` : `verrou dans ${hours} h ${String(minutes).padStart(2, "0")}`;
  }
  return `verrou dans ${minutes} min`;
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

function triggerLabelFor(betSlot: BetSlotIndicator): string {
  return betSlot.mode === "BINARY" ? "Proposer un pari" : `Proposer un pari · ${betSlot.usedSlots}/${betSlot.totalSlots}`;
}

// Compteur affiché sous l'icône pari (14/09/2026) — dérivé du même
// BetSlotIndicator que triggerLabelFor, purement présentation, aucune
// nouvelle règle métier : BINARY autorise 1 pari par match (0 ou 1 restant),
// SERIES_QUOTA un quota partagé par série (totalSlots − usedSlots).
function remainingBetsLabel(betSlot: BetSlotIndicator): string {
  const remaining = betSlot.mode === "BINARY" ? (betSlot.hasBetOnThisMatch ? 0 : 1) : Math.max(0, betSlot.totalSlots - betSlot.usedSlots);
  return `${remaining} restant${remaining > 1 ? "s" : ""}`;
}

/** Un pari DRAFT/SUBMITTED reste éditable (InlineBetForm) ; tout autre statut
 *  existant bascule en lecture seule (BetBlock) — même statuts, y compris
 *  annulé/refusé, restent visibles (décision actée avant la fusion). */
function toInlineBetOwned(bet: UpcomingMatchRowData["bet"]): InlineBetOwned | null {
  if (!bet || (bet.status !== "DRAFT" && bet.status !== "SUBMITTED")) return null;
  return { betId: bet.betId, status: bet.status, description: bet.description, category: bet.category, difficulty: bet.difficulty };
}

type UpcomingRowProps = { match: UpcomingMatchRowData };

export function UpcomingRow({ match }: UpcomingRowProps) {
  const { markDirty, clearDirty } = useUnsavedGuard(match.matchId);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showValidateConfirm, setShowValidateConfirm] = useState(false);

  // Vainqueur ET écart : la carte n'ayant plus d'état ouvert/fermé, ces deux
  // valeurs vivent directement ici, en permanence — un tap sur une équipe la
  // sélectionne, le stepper "−"/"+" apparaît à côté de son nom.
  const [winner, setWinner] = useState<string | null>(match.myWinnerTeamId);
  const [margin, setMargin] = useState<number | null>(match.myMargin);

  const isReadOnly = match.viewStatus === "VALIDATED";
  const isComplete = winner !== null && margin !== null;
  const isUnsaved = winner !== match.myWinnerTeamId || margin !== match.myMargin;

  useEffect(() => {
    const dirty = winner !== match.myWinnerTeamId || margin !== match.myMargin;
    if (dirty) markDirty();
    else clearDirty();
  }, [winner, margin, match.myWinnerTeamId, match.myMargin, markDirty, clearDirty]);

  function handleSelectTeam(teamId: string) {
    if (isReadOnly) return;
    setWinner(teamId);
  }

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

  function handleSaveDraft() {
    setError(null);
    startTransition(async () => {
      const result = await saveMatchPredictionDraft({
        matchId: match.matchId,
        predictedWinnerTeamId: winner,
        predictedMargin: margin,
      });
      if (result.success) {
        clearDirty();
        setShowValidateConfirm(false);
      } else {
        setError(result.error);
      }
    });
  }

  function handleValidate() {
    setError(null);
    startTransition(async () => {
      const result = await validateMatchPrediction(match.matchId);
      setShowValidateConfirm(false);
      if (!result.success) {
        setError(result.error);
        return;
      }
      clearDirty();
    });
  }

  function handleValidateDefinitively() {
    setError(null);
    startTransition(async () => {
      const saveResult = await saveMatchPredictionDraft({
        matchId: match.matchId,
        predictedWinnerTeamId: winner,
        predictedMargin: margin,
      });
      if (!saveResult.success) {
        setError(saveResult.error);
        return;
      }
      const result = await validateMatchPrediction(match.matchId);
      setShowValidateConfirm(false);
      if (!result.success) {
        setError(result.error);
        return;
      }
      clearDirty();
    });
  }

  return (
    <div id={`match-${match.matchId}`} className={`${styles.row} glass-card`}>
      <div className={styles.header}>
        <div className={styles.topRow}>
          {/* Grille à 3 colonnes (équipe / zone stepper partagée / équipe) —
              14/09/2026, remplace un découpage par équipe avec wrap qui
              faisait "flotter" le stepper hors de sa pastille quand il ne
              tenait pas sur la même ligne (signalé par l'utilisateur). La
              zone centrale est PARTAGÉE : elle affiche le stepper de
              l'équipe sélectionnée, quelle qu'elle soit — donc toujours à
              droite du nom pour l'équipe de gauche, toujours à gauche du nom
              pour l'équipe de droite, sans jamais pouvoir "flotter" ailleurs. */}
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

            <div className={styles.stepperSlot}>
              {winner !== null && !isReadOnly && <MarginStepper value={margin} onChange={setMargin} />}
            </div>

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
              Enregistrer le brouillon
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

        <div className={styles.metaRow}>
          <span className={styles.meta}>
            <span className={styles.time}>{formatKickoff(match.scheduledAt)}</span>
            <span className={styles.lock}>{lockLabel}</span>
          </span>
          <span className={`${styles.status} ${STATUS_CLASS[match.viewStatus]}`}>
            {/* "+" pas "−" (22/08/2026, signalé par l'utilisateur --
                "CHI −4" se lisait comme un ecart negatif alors que
                myMargin est toujours l'ecart de victoire du vainqueur
                choisi). */}
            {recap !== null ? `✓ ${recap} +${match.myMargin}` : STATUS_LABEL[match.viewStatus]}
          </span>
        </div>
      </div>

      {/* Dialogue de VALIDATION — distinct du dialogue C2 de perte de saisie :
          wording et déclencheur différents, ne pas fusionner. */}
      {showValidateConfirm && (
        <div className={styles.backdrop} role="presentation">
          <FocusTrap
            className={styles.dialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`validate-title-${match.matchId}`}
            onClose={() => setShowValidateConfirm(false)}
          >
            <p id={`validate-title-${match.matchId}`} className={styles.dialogTitle}>
              Valider ce prono ?
            </p>
            {isUnsaved ? (
              <>
                <p className={styles.dialogBody}>
                  Attention, ton brouillon n&rsquo;est pas encore enregistré. Une fois validé, le prono
                  n&rsquo;est plus modifiable — enregistre-le d&rsquo;abord si tu veux pouvoir revenir dessus.
                </p>
                <div className={styles.dialogActions}>
                  <button
                    type="button"
                    className={styles.dialogCancel}
                    onClick={() => setShowValidateConfirm(false)}
                    disabled={isPending}
                  >
                    Retour
                  </button>
                  <button
                    type="button"
                    className={styles.dialogSecondary}
                    onClick={handleSaveDraft}
                    disabled={isPending}
                  >
                    Enregistrer le brouillon
                  </button>
                  <button
                    type="button"
                    className={styles.dialogConfirm}
                    onClick={handleValidateDefinitively}
                    disabled={isPending}
                  >
                    Valider définitivement
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={styles.dialogBody}>
                  Une fois validé, il n&rsquo;est plus modifiable — et tu verras (comme les autres joueurs) les
                  pronos déjà déposés sur ce match.
                </p>
                <div className={styles.dialogActions}>
                  <button
                    type="button"
                    className={styles.dialogCancel}
                    onClick={() => setShowValidateConfirm(false)}
                    disabled={isPending}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className={styles.dialogConfirm}
                    onClick={handleValidate}
                    disabled={isPending}
                  >
                    Valider
                  </button>
                </div>
              </>
            )}
          </FocusTrap>
        </div>
      )}
    </div>
  );
}
