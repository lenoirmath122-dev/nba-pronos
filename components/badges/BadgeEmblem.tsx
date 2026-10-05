import { BADGE_ICONS } from "@/lib/badges/icons";
import { isBadgeUnlocked, tierRank } from "@/lib/badges/display";
import type { BadgeDisplay } from "@/lib/queries/badges";
import styles from "./BadgeEmblem.module.css";

// Écusson d'un badge (p3-9, retour de l'alpha « retravailler le design des
// badges », option B choisie par l'utilisateur le 05/10/2026 parmi médaille /
// écusson / plaque). Blason biseauté dont le cadre prend le métal du palier
// atteint, cœur sombre émaillé quel que soit le thème (les couleurs de palier
// sont donc les primitives sombres, pas les tokens --color-tier-* qui
// s'assombrissent en clair).
//
// Centres sur-mesure (Cadrage/DA/BADGES.pdf) une fois le badge débloqué :
// afficheur « 0.0 » du buzzer, « 0:03 » du money-time, score de série
// « 4-2 », et le record lui-même pour Métronome/Fidèle. Trop petit pour être
// lu en taille "sm" (bandeau du profil) : l'icône y reste.

type EmblemSize = "sm" | "md" | "lg";

const LED_CENTERS: Partial<Record<BadgeDisplay["id"], string>> = {
  HORLOGER: "0.0",
  OEIL_DE_LYNX: "0:03",
  SCOREUR_SERIE: "4-2",
};

const COUNTER_BADGES: ReadonlySet<BadgeDisplay["id"]> = new Set(["METRONOME", "FIDELE"]);

function emblemTier(badge: BadgeDisplay): string {
  if (!isBadgeUnlocked(badge)) return "LOCKED";
  return badge.kind === "tiered" && badge.tier ? badge.tier : "UNLOCKED";
}

function Center({ badge, size }: { badge: BadgeDisplay; size: EmblemSize }) {
  if (size !== "sm" && isBadgeUnlocked(badge)) {
    const led = LED_CENTERS[badge.id];
    if (led) return <span className={styles.led}>{led}</span>;
    if (badge.kind === "tiered" && COUNTER_BADGES.has(badge.id)) {
      return <span className={styles.counter}>{badge.value}</span>;
    }
  }
  const Icon = BADGE_ICONS[badge.id];
  return <Icon className={styles.icon} aria-hidden="true" />;
}

export function BadgeEmblem({ badge, size = "md", glow = false }: { badge: BadgeDisplay; size?: EmblemSize; glow?: boolean }) {
  return (
    <span className={styles.emblem} data-tier={emblemTier(badge)} data-size={size} data-glow={glow || undefined} aria-hidden="true">
      <span className={styles.shield}>
        <span className={styles.inner}>
          <Center badge={badge} size={size} />
        </span>
      </span>
    </span>
  );
}

/** Les 5 points de palier sous l'écusson (badges à paliers seulement). */
export function TierPips({ badge, large = false }: { badge: BadgeDisplay; large?: boolean }) {
  if (badge.kind !== "tiered") return null;
  const rank = tierRank(badge);
  return (
    <span className={styles.pips} data-tier={emblemTier(badge)} data-large={large || undefined} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((step) => (
        <i key={step} className={step <= rank ? styles.pipOn : styles.pip} />
      ))}
    </span>
  );
}
