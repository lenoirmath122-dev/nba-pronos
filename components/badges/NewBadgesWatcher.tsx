"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { FocusTrap } from "@/components/ui/FocusTrap";
import { Backdrop } from "@/components/ui/Backdrop";
import { BadgeEmblem, TierPips } from "./BadgeEmblem";
import { getUnlockedBadges } from "@/lib/actions/badges";
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
// court. Vérifié au montage de la coquille puis au retour au premier plan
// (PWA rouverte), au plus toutes les 5 minutes.

const SEEN_STORAGE_PREFIX = "badges-seen:";
// Coupe-circuit posé par les tests e2e (e2e/fixtures.ts) : la popup s'ouvre à
// un instant non déterministe et son fond avalait des clics en plein scénario.
const DISABLED_STORAGE_KEY = "badges-popup:disabled";
const INITIAL_DELAY_MS = 800;
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
  const openRef = useRef(false);
  const lastCheckRef = useRef(0);

  const check = useCallback(async () => {
    if (openRef.current || isDisabled()) return;
    lastCheckRef.current = Date.now();
    let result;
    try {
      result = await getUnlockedBadges();
    } catch {
      return;
    }
    if (!result || openRef.current) return;
    const queue = unseenBadges(result.badges, readSeen(result.userId));
    if (queue.length === 0) return;
    openRef.current = true;
    setPending({ userId: result.userId, unlocked: result.badges, queue, index: 0 });
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
    return () => {
      window.clearTimeout(initial);
      document.removeEventListener("visibilitychange", handleVisibility);
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

  if (!pending) return null;

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
