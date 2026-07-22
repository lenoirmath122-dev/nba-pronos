"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./Countdown.module.css";

// Compte à rebours d'un item "À traiter" (SPEC_ECRAN_ACCUEIL §4.1).
// SEULE feuille "use client" de l'écran Accueil : tout le reste (home/*)
// reste composant serveur. Reçoit une deadline ISO déjà calculée côté
// serveur et gère elle-même la bascule libellé large / décompte vivant /
// verrouillé, sans jamais redéclencher de rendu serveur (règle T6c : le
// client met à jour son état local, jamais revalidatePath).

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
// Pendant que le libellé est "large" (figé), on ne revérifie pas à la
// seconde : au plus toutes les 60s, ou pile au moment de basculer sous 1h.
const WIDE_RECHECK_MAX_DELAY_MS = 60_000;

type CountdownState =
  | { kind: "wide"; label: string }
  | { kind: "live"; label: string }
  | { kind: "locked" };

function formatWideLabel(remainingMs: number): string {
  if (remainingMs < ONE_DAY_MS) {
    const hours = Math.max(1, Math.round(remainingMs / ONE_HOUR_MS));
    return `dans ${hours} h`;
  }
  if (remainingMs < 2 * ONE_DAY_MS) {
    return "demain";
  }
  return `dans ${Math.round(remainingMs / ONE_DAY_MS)} jours`;
}

function formatLiveLabel(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function computeState(deadline: string, nowMs: number): CountdownState {
  const remainingMs = Date.parse(deadline) - nowMs;
  if (remainingMs <= 0) return { kind: "locked" };
  if (remainingMs > ONE_HOUR_MS) {
    return { kind: "wide", label: formatWideLabel(remainingMs) };
  }
  return { kind: "live", label: formatLiveLabel(remainingMs) };
}

type CountdownProps = {
  /** Deadline ISO calculée côté serveur (match_is_locked / bracket_deadline / bet_deadline_open). */
  deadline: string;
  /** Cible de l'action de l'item ; désactivée sur place à expiration. */
  href: string;
  children: React.ReactNode;
};

export function Countdown({ deadline, href, children }: CountdownProps) {
  // null = pas encore monté. Le tout premier rendu (SSR puis pré-hydratation
  // côté client) ne lit JAMAIS l'horloge : les deux sont donc strictement
  // identiques, aucun décalage d'hydratation possible. L'état réel n'arrive
  // qu'après montage, via l'effet ci-dessous.
  const [state, setState] = useState<CountdownState | null>(null);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const tick = () => {
      const nowMs = Date.now();
      const next = computeState(deadline, nowMs);
      setState(next);

      if (next.kind === "locked") return; // rien à reprogrammer, terminal

      const remainingMs = Date.parse(deadline) - nowMs;
      const delay =
        next.kind === "live"
          ? 1000
          : Math.min(remainingMs - ONE_HOUR_MS, WIDE_RECHECK_MAX_DELAY_MS);
      timeoutId = setTimeout(tick, Math.max(delay, 250));
    };

    tick();
    return () => clearTimeout(timeoutId);
  }, [deadline]);

  if (state?.kind === "locked") {
    return (
      <span className={styles.rowDisabled} aria-disabled="true">
        {children}
        <span className={styles.badge}>Verrouillé</span>
      </span>
    );
  }

  return (
    <Link href={href} className={styles.row}>
      {children}
      <span className={styles.badge}>{state?.label ?? ""}</span>
    </Link>
  );
}
