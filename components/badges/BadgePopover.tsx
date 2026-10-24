"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { FocusTrap } from "@/components/ui/FocusTrap";
import { Backdrop } from "@/components/ui/Backdrop";
import { TIER_LABELS, isBadgeUnlocked } from "@/lib/badges/display";
import type { BadgeDisplay } from "@/lib/queries/badges";
import { BadgeEmblem } from "./BadgeEmblem";
import styles from "./BadgePopover.module.css";

// Le seul composant client de l'identité joueur : chaque écusson d'une
// vitrine devient un bouton ; au tap, un pop-over donne le nom, le palier, la
// description et un lien vers les badges du joueur (remplace les `title`, muets
// sur mobile). Un seul pop-over ouvert à la fois : le fond couvre l'écran, il
// faut donc le fermer (fond, ✕ ou Échap via FocusTrap) avant de toucher un
// autre écusson.

const GAP_PX = 10;
const EDGE_PX = 16;
const MAX_WIDTH_PX = 352;

type Placement = { top: number; left: number; width: number };

function placementFor(trigger: HTMLElement): Placement {
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(MAX_WIDTH_PX, window.innerWidth - 2 * EDGE_PX);
  const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, EDGE_PX), window.innerWidth - width - EDGE_PX);
  return { top: rect.bottom + GAP_PX, left, width };
}

function progress(badge: BadgeDisplay): { ratio: number; left: string; right: string } | null {
  if (badge.kind === "tiered") {
    if (badge.nextThreshold === null) return { ratio: 1, left: `${badge.value}`, right: "Palier maximum" };
    return {
      ratio: Math.min(badge.value / badge.nextThreshold, 1),
      left: `${badge.value}`,
      right: `Prochain palier à ${badge.nextThreshold}`,
    };
  }
  if (badge.kind === "ladderStep") {
    return {
      ratio: Math.min(badge.value / badge.threshold, 1),
      left: `${badge.value}`,
      right: `${badge.threshold} pour débloquer`,
    };
  }
  return null;
}

type BadgePopoverProps = {
  badges: BadgeDisplay[];
  /** Pseudo du joueur, pour le libellé du lien « Voir les badges de … ». */
  ownerName: string;
  /** Destination du lien ; sans lui, le pop-over n'en montre pas. */
  badgesHref?: string;
};

export function BadgePopover({ badges, ownerName, badgesHref }: BadgePopoverProps) {
  const [open, setOpen] = useState<{ badge: BadgeDisplay; placement: Placement } | null>(null);

  const close = useCallback(() => setOpen(null), []);

  // Un défilement ou un redimensionnement déplacerait l'écusson sous le
  // pop-over : on le ferme plutôt que de le laisser flotter à côté.
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open, close]);

  const badge = open?.badge;
  const bar = badge ? progress(badge) : null;

  return (
    <>
      {badges.map((item) => (
        <button
          key={item.id}
          type="button"
          className={styles.trigger}
          aria-label={`Badge ${item.label}`}
          aria-haspopup="dialog"
          aria-expanded={open?.badge.id === item.id}
          onKeyDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            // Dans une ligne cliquable (classement) : ne déplie pas la ligne.
            event.stopPropagation();
            setOpen({ badge: item, placement: placementFor(event.currentTarget) });
          }}
        >
          <BadgeEmblem badge={item} size="sm" />
        </button>
      ))}

      {open &&
        badge &&
        createPortal(
          <Backdrop className={styles.backdrop} onClose={close}>
            <FocusTrap
              className={styles.card}
              style={{ top: open.placement.top, left: open.placement.left, width: open.placement.width }}
              role="dialog"
              aria-modal="true"
              aria-label={`Badge ${badge.label}`}
              onClose={close}
            >
              <div className={styles.head}>
                <BadgeEmblem badge={badge} size="lg" glow />
                <div className={styles.text}>
                  <p className={styles.name}>
                    {badge.label}
                    {badge.kind === "tiered" && badge.tier && (
                      <span className={styles.tier} data-tier={badge.tier}>
                        {TIER_LABELS[badge.tier]}
                      </span>
                    )}
                  </p>
                  <p className={styles.description}>{badge.description}</p>
                </div>
                <button type="button" className={styles.close} aria-label="Fermer" onClick={close}>
                  ✕
                </button>
              </div>

              {bar && (
                <div className={styles.progress}>
                  <div className={styles.progressLabels}>
                    <span>
                      Compteur : <strong>{bar.left}</strong>
                    </span>
                    <span>{bar.right}</span>
                  </div>
                  <div className={styles.track} aria-hidden="true">
                    <div className={styles.fill} style={{ width: `${Math.round(bar.ratio * 100)}%` }} />
                  </div>
                </div>
              )}
              {!isBadgeUnlocked(badge) && <p className={styles.locked}>Pas encore débloqué.</p>}

              {badgesHref && (
                <Link href={badgesHref} className={styles.link} onClick={close}>
                  <span>Voir les badges de {ownerName}</span>
                  <span aria-hidden="true">›</span>
                </Link>
              )}
            </FocusTrap>
          </Backdrop>,
          document.body
        )}
    </>
  );
}
