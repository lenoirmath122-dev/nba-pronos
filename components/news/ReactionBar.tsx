"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Flame, Laugh, MessageCircle } from "lucide-react";
import { setRecapReaction } from "@/lib/actions/recap-reactions";
import {
  RECAP_REACTION_KINDS,
  RECAP_REACTION_LABELS,
  applyReactionTap,
  type RecapReactionKind,
  type RecapReactionTarget,
  type ReactionSummary,
} from "@/lib/recaps/reactions";
import styles from "./ReactionBar.module.css";

// Réactions rapides + « Répondre » sous un highlight de nuit (Actualité,
// 13/11/2026). Mise à jour optimiste, annulée si l'action échoue (même patron
// que les réactions du chat, ChatSubscriber).

type ReactionBarProps = {
  competitionId: string;
  recapDate: string;
  target: RecapReactionTarget;
  initial: ReactionSummary;
  /** Ouvre le chat Général avec le texte pré-rempli. */
  replyHref: string;
  /** Nom du highlight, pour les libellés accessibles. */
  subject: string;
};

const ICONS: Record<RecapReactionKind, typeof Flame> = { RESPECT: Flame, CHAMBRER: Laugh };

export function ReactionBar({ competitionId, recapDate, target, initial, replyHref, subject }: ReactionBarProps) {
  const [summary, setSummary] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function tap(kind: RecapReactionKind) {
    const previous = summary;
    const next = applyReactionTap(previous, kind);
    setSummary(next);
    setError(null);
    startTransition(async () => {
      const result = await setRecapReaction(competitionId, recapDate, target, next.mine);
      if (!result.success) {
        setSummary(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className={styles.bar}>
      {RECAP_REACTION_KINDS.map((kind) => {
        const Icon = ICONS[kind];
        const active = summary.mine === kind;
        const count = summary.counts[kind];
        return (
          <button
            key={kind}
            type="button"
            className={active ? styles.chipActive : styles.chip}
            aria-pressed={active}
            aria-label={`${RECAP_REACTION_LABELS[kind]} (${subject})${count > 0 ? `, ${count}` : ""}`}
            onClick={() => tap(kind)}
          >
            <Icon size={15} aria-hidden="true" />
            <span>{RECAP_REACTION_LABELS[kind]}</span>
            {count > 0 && <span className={styles.count}>{count}</span>}
          </button>
        );
      })}
      <Link href={replyHref} className={styles.reply}>
        <MessageCircle size={15} aria-hidden="true" />
        Répondre
      </Link>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
