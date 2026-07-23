import Link from "next/link";
import { useGuardedNavigation } from "@/lib/hooks/useUnsavedGuard";
import type { BetSlotIndicator } from "@/lib/queries/matches";
import styles from "./BetShortcut.module.css";

// Raccourci pari (§10, acté 23/07/2026) — entrée SECONDAIRE, visuellement
// distincte du CTA de validation. Sans "use client" propre : rendu par
// PredictionForm.
//
// Destination : hors périmètre de cet écran (lot « Paris », §18.3 — non fixée
// nulle part). /play existe déjà comme hub provisoire ; on y pointe en
// attendant que /play/bets/new?matchId=… soit une vraie route.
const BET_SHORTCUT_HREF_PLACEHOLDER = "/play";

type BetShortcutProps = { betSlot: BetSlotIndicator };

export function BetShortcut({ betSlot }: BetShortcutProps) {
  const guardNavigation = useGuardedNavigation();

  if (betSlot.hasBetOnThisMatch) {
    return (
      <span className={styles.disabled} aria-disabled="true">
        Pari déjà posé sur ce match
      </span>
    );
  }

  // Second état obligatoire (§10) : le compteur x/3 dit combien de slots
  // restent sur la SÉRIE, jamais si CE match précis en porte déjà un — ce
  // 2e cas est couvert par la branche hasBetOnThisMatch ci-dessus.
  const label =
    betSlot.mode === "BINARY" ? "Proposer un pari" : `Proposer un pari · ${betSlot.usedSlots}/${betSlot.totalSlots}`;

  return (
    <Link
      href={BET_SHORTCUT_HREF_PLACEHOLDER}
      className={styles.shortcut}
      onNavigate={(event) => guardNavigation(event, BET_SHORTCUT_HREF_PLACEHOLDER)}
    >
      {label}
    </Link>
  );
}
