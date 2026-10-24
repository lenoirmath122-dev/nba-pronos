"use client";

import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Pin } from "lucide-react";
import { Backdrop } from "@/components/ui/Backdrop";
import { FocusTrap } from "@/components/ui/FocusTrap";
import { togglePinnedBadgeFormAction } from "@/lib/actions/profile";
import { TIER_LABELS, TIER_ORDER, isBadgeUnlocked, tierRank, unseenBadges, type SeenBadges } from "@/lib/badges/display";
import { closestBadges, countUnlocked, tierThresholds } from "@/lib/badges/summary";
import { BADGES_SEEN_KEY, useSeenValue } from "@/lib/seen/store";
import type { BadgeDisplay, ProfileBadgesData } from "@/lib/queries/badges";
import { BadgeEmblem, TierPips } from "./BadgeEmblem";
import styles from "./BadgesTab.module.css";

// Onglet Badges (chantier Profil & badges, Lot 4) : « N/35 débloqués », les
// badges les plus proches d'un palier, la vitrine, des filtres et une grille à
// 2 colonnes. Un tap ouvre une fiche détail (bottom sheet sur mobile, panneau
// centré sur desktop) qui remplace l'ancienne carte retournable.
//
// Écart au plan : tout est dans ce composant client (filtres, grille, fiche)
// plutôt que « grille serveur + sheet client » — le filtre, la grille et la
// fiche partagent un même état, et les données arrivent déjà calculées. Pas de
// bouton « Modifier » : la vitrine se règle depuis la fiche de chaque badge.
//
// `readOnly` : onglet d'un autre joueur (aucun bouton de vitrine).

const SHOWCASE_SLOTS = 3;
const CLOSEST_COUNT = 3;

type Filter = "all" | "unlocked" | "locked";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "unlocked", label: "Débloqués" },
  { id: "locked", label: "À débloquer" },
];

function statusLabel(badge: BadgeDisplay): string {
  if (badge.kind === "tiered") {
    if (badge.tier) return TIER_LABELS[badge.tier];
    return badge.nextThreshold ? `${badge.value}/${badge.nextThreshold}` : "Verrouillé";
  }
  if (badge.kind === "ladderStep") return badge.unlocked ? "Débloqué" : `${badge.value}/${badge.threshold}`;
  return badge.unlocked ? "Débloqué" : "Verrouillé";
}

// `undefined` = pas encore chargé : aucune puce plutôt qu'un faux « tout est nouveau ».
function parseSeen(raw: string | null | undefined): SeenBadges | null {
  if (raw === undefined) return null;
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    return value && typeof value === "object" ? (value as SeenBadges) : {};
  } catch {
    return {};
  }
}

type Props = {
  data: ProfileBadgesData;
  /** Onglet d'un autre joueur : pas de vitrine modifiable, pas de puce « nouveau ». */
  readOnly?: boolean;
};

export function BadgesTab({ data, readOnly = false }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<BadgeDisplay | null>(null);

  const all = useMemo(() => data.categories.flatMap((category) => category.badges), [data.categories]);
  const unlockedCount = countUnlocked(all);
  const closest = useMemo(() => closestBadges(all, CLOSEST_COUNT), [all]);

  const seen = parseSeen(useSeenValue(BADGES_SEEN_KEY));
  const freshIds = useMemo(
    () => (readOnly || seen === null ? new Set<string>() : new Set<string>(unseenBadges(all, seen).map((badge) => badge.id))),
    [all, readOnly, seen]
  );

  const close = useCallback(() => setSelected(null), []);

  if (data.categories.length === 0) {
    return <p className={styles.empty}>Bientôt disponible.</p>;
  }

  const matches = (badge: BadgeDisplay) => filter === "all" || isBadgeUnlocked(badge) === (filter === "unlocked");
  const visibleCategories = data.categories
    .map((category) => ({ ...category, badges: category.badges.filter(matches) }))
    .filter((category) => category.badges.length > 0);

  const slots: (BadgeDisplay | null)[] = Array.from({ length: SHOWCASE_SLOTS }, (_, i) => data.pinnedBadges[i] ?? null);

  return (
    <div className={styles.wrapper}>
      <header className={styles.summary}>
        <p className={styles.count}>
          <strong>{unlockedCount}</strong>/{all.length} débloqués
        </p>
        {closest.length > 0 && (
          <div className={styles.closest}>
            <h3 className={styles.sectionTitle}>Le plus proche</h3>
            <ul className={styles.closestList}>
              {closest.map(({ badge, remaining, target }) => (
                <li key={badge.id} className={styles.item}>
                  <button type="button" className={styles.closestItem} onClick={() => setSelected(badge)}>
                    <BadgeEmblem badge={badge} size="sm" />
                    <span className={styles.closestText}>
                      <span className={styles.closestName}>{badge.label}</span>
                      <span className={styles.closestNote}>
                        {badge.kind === "tiered" ? `Plus que ${remaining} pour ${target}` : `Plus que ${remaining}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>

      <section className={styles.showcase} aria-label="Vitrine">
        <div className={styles.showcaseHead}>
          <h3 className={styles.sectionTitle}>Vitrine</h3>
        </div>
        <ul className={styles.slots}>
          {slots.map((badge, index) => (
            <li key={badge?.id ?? `empty-${index}`} className={styles.slot} data-empty={badge ? undefined : true}>
              {badge ? (
                <button type="button" className={styles.slotButton} onClick={() => setSelected(badge)}>
                  <BadgeEmblem badge={badge} size="md" />
                  <span className={styles.slotLabel}>{badge.label}</span>
                </button>
              ) : (
                <span className={styles.slotEmpty}>Libre</span>
              )}
            </li>
          ))}
        </ul>
        {!readOnly && (
          <p className={styles.hint}>Touche l’épingle d’un badge débloqué pour le mettre en vitrine. {SHOWCASE_SLOTS} maximum.</p>
        )}
      </section>

      <div className={styles.filters} role="group" aria-label="Filtrer les badges">
        {FILTERS.map(({ id, label }) => (
          <button key={id} type="button" className={styles.filter} aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      {visibleCategories.length === 0 && <p className={styles.empty}>Aucun badge dans ce filtre.</p>}
      {visibleCategories.map((category) => (
        <section key={category.id} className={styles.category} aria-label={category.title}>
          <h3 className={styles.sectionTitle}>{category.title}</h3>
          <ul className={styles.grid}>
            {category.badges.map((badge) => (
              <li key={badge.id}>
                <button
                  type="button"
                  className={styles.card}
                  data-locked={isBadgeUnlocked(badge) ? undefined : true}
                  aria-label={`${badge.label}, ${statusLabel(badge)}`}
                  onClick={() => setSelected(badge)}
                >
                  {(readOnly || !isBadgeUnlocked(badge)) && badge.pinned && (
                    <span className={styles.pinned} role="img" aria-label="En vitrine">
                      <Pin aria-hidden="true" />
                    </span>
                  )}
                  {freshIds.has(badge.id) && <span className={styles.fresh} role="img" aria-label="Nouveau" />}
                  <BadgeEmblem badge={badge} />
                  <TierPips badge={badge} />
                  <span className={styles.cardLabel}>{badge.label}</span>
                  <span className={styles.cardStatus}>{statusLabel(badge)}</span>
                </button>
                {/* Épingle directe (sans ouvrir la fiche) : frère du bouton de la
                    carte, un bouton ne pouvant pas en contenir un autre. */}
                {!readOnly && isBadgeUnlocked(badge) && (
                  <form action={togglePinnedBadgeFormAction} className={styles.pinForm}>
                    <input type="hidden" name="badgeId" value={badge.id} />
                    <button
                      type="submit"
                      className={styles.pinQuick}
                      data-on={badge.pinned || undefined}
                      disabled={!badge.pinned && data.pinnedBadges.length >= SHOWCASE_SLOTS}
                      aria-pressed={badge.pinned}
                      aria-label={`${badge.pinned ? "Retirer de" : "Mettre en"} la vitrine : ${badge.label}`}
                    >
                      <Pin aria-hidden="true" />
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {selected &&
        createPortal(
          <Backdrop className={styles.backdrop} onClose={close}>
            <FocusTrap
              className={styles.sheet}
              role="dialog"
              aria-modal="true"
              aria-label={`Badge ${selected.label}`}
              onClose={close}
            >
              <BadgeSheet badge={selected} readOnly={readOnly} canPin={data.pinnedBadges.length < SHOWCASE_SLOTS} onClose={close} />
            </FocusTrap>
          </Backdrop>,
          document.body
        )}
    </div>
  );
}

function BadgeSheet({
  badge,
  readOnly,
  canPin,
  onClose,
}: {
  badge: BadgeDisplay;
  readOnly: boolean;
  canPin: boolean;
  onClose: () => void;
}) {
  const unlocked = isBadgeUnlocked(badge);
  const thresholds = tierThresholds(badge);
  const reached = tierRank(badge);

  return (
    <>
      <div className={styles.sheetHead}>
        <BadgeEmblem badge={badge} size="lg" glow />
        <div className={styles.sheetText}>
          <p className={styles.sheetName}>{badge.label}</p>
          <p className={styles.sheetDescription}>{badge.description}</p>
        </div>
        <button type="button" className={styles.close} aria-label="Fermer" onClick={onClose}>
          ✕
        </button>
      </div>

      {badge.kind === "tiered" && (
        <>
          <p className={styles.sheetCounter}>
            Compteur : <strong>{badge.value}</strong>
          </p>
          <ol className={styles.tiers}>
            {TIER_ORDER.map((tier, index) => (
              <li key={tier} className={styles.tierRow} data-tier={tier} data-reached={index < reached || undefined}>
                <span className={styles.tierName}>{TIER_LABELS[tier]}</span>
                <span className={styles.tierThreshold}>{thresholds[index]}</span>
                <span className={styles.tierState}>{index < reached ? "Atteint" : "—"}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      {badge.kind === "ladderStep" && (
        <p className={styles.sheetCounter}>
          Progression : <strong>{badge.value}</strong>/{badge.threshold}
        </p>
      )}
      {!unlocked && <p className={styles.sheetLocked}>Pas encore débloqué.</p>}

      {!readOnly && unlocked && (
        <form action={togglePinnedBadgeFormAction}>
          <input type="hidden" name="badgeId" value={badge.id} />
          <button type="submit" className={styles.pinAction} disabled={!badge.pinned && !canPin} aria-pressed={badge.pinned}>
            <Pin aria-hidden="true" />
            {badge.pinned ? "Retirer de la vitrine" : canPin ? "Mettre en vitrine" : "Vitrine pleine (3 maximum)"}
          </button>
        </form>
      )}
    </>
  );
}
