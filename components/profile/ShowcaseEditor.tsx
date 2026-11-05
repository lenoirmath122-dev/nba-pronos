"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { Backdrop } from "@/components/ui/Backdrop";
import { FocusTrap } from "@/components/ui/FocusTrap";
import { setShowcaseBadgeFormAction, togglePinnedBadgeFormAction } from "@/lib/actions/profile";
import { BadgeEmblem } from "@/components/badges/BadgeEmblem";
import type { BadgeDisplay } from "@/lib/queries/badges";
import styles from "./ShowcaseEditor.module.css";

// Vitrine de l'en-tête de « Mon profil » : 3 emplacements. Un emplacement
// libre (« + ») ou occupé ouvre une fenêtre qui liste les badges débloqués et
// permet d'en choisir un directement, sans passer par l'onglet Badges.
// Formulaires natifs (même patron que BadgesTab) : la page se recharge avec
// la vitrine à jour.
const SLOTS = 3;

type Props = {
  /** Badges épinglés, dans l'ordre des emplacements. */
  pinned: BadgeDisplay[];
  /** Badges débloqués, épinglés ou non. */
  unlocked: BadgeDisplay[];
  /** Page à rouvrir après le choix (jamais une URL libre : validée côté serveur). */
  returnTo: string;
};

export function ShowcaseEditor({ pinned, unlocked, returnTo }: Props) {
  const [slot, setSlot] = useState<number | null>(null);
  const close = useCallback(() => setSlot(null), []);

  const pinnedIds = new Set(pinned.map((badge) => badge.id));
  const current = slot !== null ? (pinned[slot] ?? null) : null;
  const choices = unlocked.filter((badge) => !pinnedIds.has(badge.id));

  return (
    <>
      <ul className={styles.slots} aria-label="Vitrine">
        {Array.from({ length: SLOTS }, (_, index) => {
          const badge = pinned[index] ?? null;
          return (
            <li key={index}>
              <button
                type="button"
                className={badge ? styles.slot : styles.slotEmpty}
                aria-label={
                  badge
                    ? `${badge.label}, changer l’emplacement ${index + 1}`
                    : `Emplacement libre ${index + 1}, choisir un badge`
                }
                aria-haspopup="dialog"
                onClick={() => setSlot(index)}
              >
                {badge ? (
                  <>
                    <BadgeEmblem badge={badge} size="md" />
                    <span className={styles.slotName}>{badge.label}</span>
                  </>
                ) : (
                  <>
                    <Plus aria-hidden="true" className={styles.plus} />
                    <span className={styles.slotHint}>Libre</span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {slot !== null &&
        createPortal(
          <Backdrop className={styles.backdrop} onClose={close}>
            <FocusTrap
              className={styles.dialog}
              role="dialog"
              aria-modal="true"
              aria-label={`Vitrine, emplacement ${slot + 1}`}
              onClose={close}
            >
              <div className={styles.head}>
                <h2 className={styles.title}>Emplacement {slot + 1}</h2>
                <button type="button" className={styles.close} aria-label="Fermer" onClick={close}>
                  ✕
                </button>
              </div>

              {current && (
                <form action={togglePinnedBadgeFormAction} className={styles.currentRow}>
                  <input type="hidden" name="badgeId" value={current.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <BadgeEmblem badge={current} size="sm" />
                  <span className={styles.name}>{current.label}</span>
                  <button type="submit" className={styles.remove}>
                    Retirer
                  </button>
                </form>
              )}

              {choices.length === 0 ? (
                <p className={styles.empty}>Aucun autre badge débloqué pour l&rsquo;instant.</p>
              ) : (
                <ul className={styles.list}>
                  {choices.map((badge) => (
                    <li key={badge.id}>
                      <form action={setShowcaseBadgeFormAction}>
                        <input type="hidden" name="badgeId" value={badge.id} />
                        <input type="hidden" name="slot" value={slot} />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <button type="submit" className={styles.choice}>
                          <BadgeEmblem badge={badge} size="sm" />
                          <span className={styles.choiceText}>
                            <span className={styles.name}>{badge.label}</span>
                            <span className={styles.desc}>{badge.description}</span>
                          </span>
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </FocusTrap>
          </Backdrop>,
          document.body
        )}
    </>
  );
}
