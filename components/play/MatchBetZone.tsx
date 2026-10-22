"use client";

import { useEffect, useId, useState, useTransition } from "react";
import type { PlayAssociatedBet } from "@/lib/queries/play";
import { submitBet } from "@/lib/actions/bets";
import { useUnsavedGuard } from "@/lib/hooks/useUnsavedGuard";
import { requestBadgeCheck } from "@/lib/badges/checkRequest";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useValidatedDialog } from "@/components/ui/ValidatedDialog";
import { EyeIcon } from "@/components/icons/play-icons";
import { PlayerNotInMatchConfirm } from "@/components/bets/PlayerNotInMatchConfirm";
import { validatedBetDialog, PENDING_ADMIN_TOAST } from "@/components/bets/validatedBetDialog";
import { possiblePointsLabel } from "./BetBlock";
import styles from "./MatchBetZone.module.css";

// Zone « Mon pari » en bas des cartes de match (Mes pronos : UpcomingRow ;
// Résultats : LockedRow en lecture seule). Remplace le déclencheur « Proposer
// un pari » (InlineBetForm en popup) de la carte Jouer : la saisie se fait
// directement ici et appelle la même server action (submitBet) avec la même
// logique (confirmation « joueur absent du match », popup/toast de retour).
// Quatre états : ouvert (saisie), soumis (lecture), fermé sans pari.

type Props = {
  matchId: string;
  seriesId: string;
  /** Pari du joueur sur ce match (tout statut) ; un DRAFT préremplit la saisie. */
  bet: PlayAssociatedBet | null;
  /** null = pari possible. Sinon, raison affichée dans le champ désactivé. */
  closedMessage: string | null;
  /** Carte verrouillée (Résultats) : libellé du méta « verrouillé » seul. */
  locked?: boolean;
  /** Nom court d'une des deux équipes, pour le placeholder. */
  placeholderTeam: string;
  /** Maximum du barème des paris de la compétition. */
  maxPoints: number;
  onViewOthers: () => void;
};

type LocalSubmission = {
  description: string;
  validated: boolean;
  points: number | null;
};

type TagKind = "win" | "loss" | "dashed";

function statusTag(bet: PlayAssociatedBet | null): {
  label: string;
  kind: TagKind;
} {
  if (!bet) return { label: "En analyse", kind: "dashed" };
  switch (bet.status) {
    case "VALIDATED":
      return { label: "Validé", kind: "win" };
    case "WON":
      return { label: "Gagné", kind: "win" };
    case "LOST":
      return { label: "Perdu", kind: "loss" };
    case "REJECTED":
      return { label: "Refusé", kind: "loss" };
    case "CANCELLED":
      return { label: "Neutralisé", kind: "dashed" };
    default:
      return { label: "En attente", kind: "dashed" };
  }
}

function pointsTag(bet: PlayAssociatedBet): string | null {
  if (bet.status === "WON") return bet.pointsAwarded === null ? null : `+${bet.pointsAwarded} pts`;
  return possiblePointsLabel(bet.status, bet.pointsAtStake);
}

export function MatchBetZone({
  matchId,
  seriesId,
  bet,
  closedMessage,
  locked = false,
  placeholderTeam,
  maxPoints,
  onViewOthers,
}: Props) {
  const draft = bet?.status === "DRAFT" ? bet : null;
  const serverSubmitted = bet && bet.status !== "DRAFT" ? bet : null;

  const [description, setDescription] = useState(draft?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [notInMatch, setNotInMatch] = useState<string | null>(null);
  const [draftBetId, setDraftBetId] = useState<string | null>(draft?.betId ?? null);
  // Soumission réussie pas encore reflétée par les données serveur : la carte
  // passe tout de suite à l'état « soumis » sans attendre le rafraîchissement.
  const [local, setLocal] = useState<LocalSubmission | null>(null);
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();
  const showValidated = useValidatedDialog();
  const { markDirty, clearDirty } = useUnsavedGuard(`bet:${matchId}`);
  const fieldId = useId();

  const isOpen = closedMessage === null && !serverSubmitted && !local;
  const empty = description.trim().length === 0;

  useEffect(() => {
    if (isOpen && description !== (draft?.description ?? "")) markDirty();
    else clearDirty();
  }, [isOpen, description, draft?.description, markDirty, clearDirty]);

  useEffect(() => () => clearDirty(), [clearDirty]);

  function handleSubmit(confirmPlayerNotInMatch = false) {
    setError(null);
    startTransition(async () => {
      const payload = {
        betId: draftBetId ?? undefined,
        scope: "MATCH" as const,
        seriesId,
        matchId,
        description,
      };
      const result = await submitBet({ ...payload, confirmPlayerNotInMatch });
      if (result.success && "playerNotInMatch" in result) {
        clearDirty();
        setDraftBetId(result.betId);
        setNotInMatch(result.playerNotInMatch);
        return;
      }
      setNotInMatch(null);
      if (!result.success) {
        setError(result.error);
        return;
      }
      clearDirty();
      requestBadgeCheck();
      const validated = result.outcome === "VALIDATED";
      if (validated) showValidated(validatedBetDialog(payload.description, result.probaPct, result.points));
      else showToast(PENDING_ADMIN_TOAST);
      setLocal({
        description: payload.description,
        validated,
        points: validated ? result.points : null,
      });
    });
  }

  const othersButton = (
    <button type="button" className={styles.outline} onClick={onViewOthers}>
      <EyeIcon size={18} />
      Voir les paris des autres
    </button>
  );

  if (isOpen) {
    return (
      <div className={styles.zone}>
        <div className={styles.head}>
          <label htmlFor={fieldId} className={styles.label}>
            Mon pari
          </label>
          <span className={styles.meta}>jusqu&rsquo;à {maxPoints} pts</span>
        </div>
        <textarea
          id={fieldId}
          className={styles.textarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={`Ex. Les ${placeholderTeam} prennent plus de 45 rebonds`}
          rows={3}
          maxLength={2000}
          disabled={isPending}
        />
        <p className={styles.hint}>
          Un joueur, une stat, un seuil. Soumets ton pari pour voir ceux des autres.
        </p>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {notInMatch ? (
          <PlayerNotInMatchConfirm
            playerName={notInMatch}
            isPending={isPending}
            onEdit={() => {
              setNotInMatch(null);
              document.getElementById(fieldId)?.focus();
            }}
            onConfirm={() => handleSubmit(true)}
          />
        ) : (
          <button type="button" className={styles.primary} onClick={() => handleSubmit()} disabled={isPending || empty}>
            {isPending ? (
              <>
                <Spinner size="sm" />
                Analyse du pari…
              </>
            ) : (
              "Soumettre"
            )}
          </button>
        )}
      </div>
    );
  }

  if (serverSubmitted || local) {
    const statement = serverSubmitted?.description ?? local?.description ?? "";
    const status =
      serverSubmitted === null && local?.validated
        ? { label: "Validé", kind: "win" as const }
        : statusTag(serverSubmitted);
    const levelTag =
      serverSubmitted === null
        ? local?.validated
          ? null
          : "Niveau en calcul…"
        : serverSubmitted.status === "REJECTED" || serverSubmitted.status === "CANCELLED"
          ? null
          : serverSubmitted.isDifficultyValidated
            ? `Niveau ${serverSubmitted.difficulty}`
            : "Niveau en calcul…";
    const points = serverSubmitted
      ? pointsTag(serverSubmitted)
      : local?.points != null
        ? `${local.points} pts en jeu`
        : null;
    const statusClass =
      status.kind === "win" ? styles.tagWin : status.kind === "loss" ? styles.tagLoss : styles.tagDashed;

    return (
      <div className={styles.zone}>
        <div className={styles.head}>
          <span className={styles.label}>Mon pari</span>
          <span className={styles.meta}>{locked ? "verrouillé" : "verrouillé au coup d’envoi"}</span>
        </div>
        <div className={styles.submitted}>
          <p className={styles.statement}>{statement}</p>
          <div className={styles.tags}>
            {levelTag && <span className={styles.tag}>{levelTag}</span>}
            {points && <span className={styles.tag}>{points}</span>}
            <span className={`${styles.tag} ${statusClass}`}>{status.label}</span>
          </div>
        </div>
        {othersButton}
      </div>
    );
  }

  return (
    <div className={styles.zone}>
      <div className={styles.head}>
        <span className={`${styles.label} ${styles.labelClosed}`}>Mon pari</span>
        <span className={styles.meta}>paris fermés</span>
      </div>
      <textarea
        className={`${styles.textarea} ${styles.textareaClosed}`}
        placeholder={closedMessage ?? ""}
        rows={3}
        disabled
        aria-label="Mon pari"
      />
      <p className={styles.hint}>Tu n&rsquo;as pas posé de pari sur ce match.</p>
      {othersButton}
    </div>
  );
}
