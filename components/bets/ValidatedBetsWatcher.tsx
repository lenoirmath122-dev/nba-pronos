"use client";

import { useEffect } from "react";
import { fetchSeenState, saveSeenState, VALIDATED_BETS_SEEN_KEY } from "@/lib/seen/store";
import { useValidatedDialog } from "@/components/ui/ValidatedDialog";
import type { AdminValidatedBet } from "@/lib/queries/bets";

// Popup « Pari validé » pour les paris validés par un admin pendant que le
// joueur n'était pas là (04/10/2026). N'affiche rien d'autre : compare les
// validations reçues de la coquille à la dernière déjà montrée au COMPTE
// (user_seen_state, lib/seen/store.ts), donc une seule fois quel que soit
// l'appareil.
//
// Premier passage (repère absent) : on retient l'instant présent sans rien
// montrer, sinon tout l'historique récent sauterait au visage d'un coup.
const LEGACY_LOCAL_KEY = "validated-bets-seen-at";

export function ValidatedBetsWatcher({ bets }: { bets: AdminValidatedBet[] }) {
  const showValidated = useValidatedDialog();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const seenAt = await fetchSeenState(VALIDATED_BETS_SEEN_KEY, LEGACY_LOCAL_KEY).catch(() => undefined);
      if (cancelled || seenAt === undefined) return;
      if (seenAt === null) {
        await saveSeenState(VALIDATED_BETS_SEEN_KEY, new Date().toISOString());
        return;
      }

      const unseen = bets.filter((bet) => Date.parse(bet.validatedAt) > Date.parse(seenAt));
      if (unseen.length === 0) return;

      await saveSeenState(VALIDATED_BETS_SEEN_KEY, unseen[unseen.length - 1].validatedAt);
      if (cancelled) return;
      showValidated({
        title: unseen.length > 1 ? `${unseen.length} paris validés` : "Pari validé",
        items: unseen.map((bet) => bet.description),
        note: unseen.length > 1 ? "Validés par l'admin, ils sont en jeu." : "Validé par l'admin, il est en jeu.",
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [bets, showValidated]);

  return null;
}
