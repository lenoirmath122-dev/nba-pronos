"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { FocusTrap } from "@/components/ui/FocusTrap";
import { Backdrop } from "@/components/ui/Backdrop";
import { BadgeEmblem, TierPips } from "./BadgeEmblem";
import { useIsValidatedDialogOpen } from "@/components/ui/ValidatedDialog";
import { getUnlockedBadges } from "@/lib/actions/badges";
import { onBadgeCheckRequest } from "@/lib/badges/checkRequest";
import { TIER_LABELS, seenSnapshot, tierRank, unseenBadges, type SeenBadges } from "@/lib/badges/display";
import type { BadgeDisplay } from "@/lib/queries/badges";
import styles from "./NewBadgesWatcher.module.css";

// Popup « nouveau badge » (p3-9, retour de l'alpha : « popup à l'ouverture
// quand un badge a été gagné depuis la dernière visite »). Les badges sont
// calculés à la volée (aucune date de déblocage en base) : l'appareil retient
// le palier déjà montré de chaque badge, état purement client comme les
// non-lus du chat (lib/nav/chatSeen.ts), une clé par compte.
//
// Premier passage sur un appareil : TOUS les badges déjà gagnés défilent
// (choix de l'utilisateur, 05/10/2026), avec « Tout passer » pour couper
// court. Vérifié au montage de la coquille, au retour au premier plan (PWA
// rouverte, au plus toutes les 5 minutes) et juste après un geste qui peut
// débloquer un badge (requestBadgeCheck, lib/badges/checkRequest.ts). Attend
// la fermeture de la popup « Pari validé » s'il y en a une, plutôt que de
// s'empiler par-dessus.

const SEEN_STORAGE_PREFIX = "badges-seen:";
// Coupe-circuit posé par les tests e2e (e2e/fixtures.ts) : la popup s'ouvre à
// un instant non déterministe et son fond avalait des clics en plein scénario.
const DISABLED_STORAGE_KEY = "badges-popup:disabled";
const INITIAL_DELAY_MS = 800;
// Après un geste : laisse d'abord passer le toast ou la popup « validé ».
const AFTER_ACTION_DELAY_MS = 600;
const RECHECK_INTERVAL_MS = 5 * 60 * 1000;
const MAX_DOTS = 8;
const BADGES_HREF = "/profile?tab=stats#stats-badges";

function readSeen(userId: string): SeenBadges {
  try {
    const raw = window.localStorage.getItem(SEEN_STORAGE_PREFIX + userId);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return value && typeof value === "object" ? (value as SeenBadges) : {};
  } catch {
    return {};
  }
}

function isDisabled(): boolean {
  try {
    return window.localStorage.getItem(DISABLED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSeen(userId: string, seen: SeenBadges) {
  try {
    window.localStorage.setItem(SEEN_STORAGE_PREFIX + userId, JSON.stringify(seen));
  } catch {
    // Stockage indisponible (navigation privée) : la popup reviendra, sans gravité.
  }
}

type Pending = { userId: string; unlocked: BadgeDisplay[]; queue: BadgeDisplay[]; index: number };

function progressNote(badge: BadgeDisplay): string | null {
  if (badge.kind !== "tiered") return null;
  return badge.nextThreshold === null
    ? `${badge.value} au compteur · palier maximum atteint`
    : `${badge.value} au compteur · prochain palier à ${badge.nextThreshold}`;
}

export function NewBadgesWatcher() {
  const [pending, setPending] = useState<Pending | null>(null);
  const validatedDialogOpen = useIsValidatedDialogOpen();
  const openRef = useRef(false);
  const lastCheckRef = useRef(0);
  const inFlightRef = useRef(false);
  const rerunRef = useRef(false);

  const check = useCallback(async () => {
    if (openRef.current || isDisabled()) return;
    // Une demande pendant une lecture en cours peut concerner un geste que
    // cette lecture n'a pas vu : on relit une fois de plus à la fin.
    if (inFlightRef.current) {
      rerunRef.current = true;
      return;
    }
    inFlightRef.current = true;
    try {
      do {
        rerunRef.current = false;
        lastCheckRef.current = Date.now();
        let result;
        try {
          result = await getUnlockedBadges();
        } catch {
          return;
        }
        if (!result || openRef.current) return;
        const queue = unseenBadges(result.badges, readSeen(result.userId));
        if (queue.length > 0) {
          openRef.current = true;
          setPending({ userId: result.userId, unlocked: result.badges, queue, index: 0 });
          return;
        }
      } while (rerunRef.current);
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Léger délai au montage : la page s'affiche d'abord, la popup ensuite.
    const initial = window.setTimeout(() => void check(), INITIAL_DELAY_MS);
    function handleVisibility() {
      if (document.visibilityState === "visible" && Date.now() - lastCheckRef.current > RECHECK_INTERVAL_MS) {
        void check();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    let afterAction: number | undefined;
    const unsubscribe = onBadgeCheckRequest(() => {
      window.clearTimeout(afterAction);
      afterAction = window.setTimeout(() => void check(), AFTER_ACTION_DELAY_MS);
    });
    return () => {
      window.clearTimeout(initial);
      window.clearTimeout(afterAction);
      document.removeEventListener("visibilitychange", handleVisibility);
      unsubscribe();
    };
  }, [check]);

  // Toute sortie (OK, Tout passer, Voir mes badges, fond, Échap) marque
  // l'ensemble des badges débloqués comme vus.
  const finish = useCallback(() => {
    if (pending) writeSeen(pending.userId, { ...readSeen(pending.userId), ...seenSnapshot(pending.unlocked) });
    openRef.current = false;
    setPending(null);
  }, [pending]);

  const next = useCallback(() => {
    if (!pending) return;
    if (pending.index + 1 >= pending.queue.length) {
      finish();
      return;
    }
    setPending({ ...pending, index: pending.index + 1 });
  }, [pending, finish]);

  if (!pending || validatedDialogOpen) return null;

  const badge = pending.queue[pending.index];
  const total = pending.queue.length;
  const isLast = pending.index + 1 >= total;
  const note = progressNote(badge);

  return createPortal(
    <Backdrop className={styles.backdrop} onClose={finish}>
      <FocusTrap
        key={badge.id}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-badge-title"
        onClose={finish}
      >
        <p className={styles.eyebrow}>{tierRank(badge) > 1 ? "Nouveau palier" : "Nouveau badge"}</p>
        <div className={styles.stage}>
          <span className={styles.rays} aria-hidden="true" />
          <BadgeEmblem badge={badge} size="lg" glow />
        </div>
        <h2 id="new-badge-title" className={styles.title}>
          {badge.label}
        </h2>
        {badge.kind === "tiered" && badge.tier && (
          <p className={styles.tierLine} data-tier={badge.tier}>
            <span>Palier {TIER_LABELS[badge.tier]}</span>
            <TierPips badge={badge} large />
          </p>
        )}
        <p className={styles.description}>{badge.description}</p>
        {note && <p className={styles.note}>{note}</p>}
        {total > 1 && total <= MAX_DOTS && (
          <span className={styles.dots} aria-hidden="true">
            {pending.queue.map((queued, index) => (
              <i key={queued.id} className={index === pending.index ? styles.dotActive : styles.dot} />
            ))}
          </span>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={next}>
            {isLast ? "OK" : `Suivant (${pending.index + 1}/${total})`}
          </button>
          <div className={styles.secondaryRow}>
            <Link href={BADGES_HREF} className={styles.secondary} onClick={finish}>
              Voir mes badges
            </Link>
            {!isLast && (
              <button type="button" className={styles.secondary} onClick={finish}>
                Tout passer
              </button>
            )}
          </div>
        </div>
      </FocusTrap>
    </Backdrop>,
    document.body
  );
}
