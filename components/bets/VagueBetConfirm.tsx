"use client";

import { useEffect, useRef } from "react";
import { Spinner } from "@/components/ui/Spinner";
import styles from "./PlayerNotInMatchConfirm.module.css";

// Lot 2 (28/10/2026) : même patron que PlayerNotInMatchConfirm, affiché quand
// submitBet() renvoie `vagueBet` -- l'IA ne sait pas sur quoi porte le pari
// (ex. « Plus de 10 rebonds » sans joueur ni équipe). Le pari est déjà
// repassé en brouillon côté serveur. Envoyé tel quel, il part en file admin.

type VagueBetConfirmProps = {
  question: string;
  isPending: boolean;
  onEdit: () => void;
  onConfirm: () => void;
};

export function VagueBetConfirm({ question, isPending, onEdit, onConfirm }: VagueBetConfirmProps) {
  const titleRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <div className={styles.box} role="alertdialog" aria-labelledby="vague-bet-title" aria-describedby="vague-bet-desc">
      <p id="vague-bet-title" ref={titleRef} tabIndex={-1} className={styles.title}>
        Tu peux préciser ton pari&nbsp;?
      </p>
      <p id="vague-bet-desc" className={styles.text}>
        {question} Ton pari est resté en brouillon. Précisé, il a de bonnes chances d&rsquo;être calculé tout de suite&nbsp;;
        envoyé tel quel, un admin devra l&rsquo;interpréter.
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={onEdit} disabled={isPending}>
          Préciser le pari
        </button>
        <button type="button" className={styles.secondary} onClick={onConfirm} disabled={isPending}>
          {isPending ? (
            <span className={styles.pending}>
              <Spinner size="sm" />
              Envoi…
            </span>
          ) : (
            "Envoyer quand même"
          )}
        </button>
      </div>
    </div>
  );
}
