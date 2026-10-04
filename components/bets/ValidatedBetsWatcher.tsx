"use client";

import { useEffect } from "react";
import { useValidatedDialog } from "@/components/ui/ValidatedDialog";
import type { AdminValidatedBet } from "@/lib/queries/bets";

// Popup « Pari validé » pour les paris validés par un admin pendant que le
// joueur n'était pas là (04/10/2026). N'affiche rien d'autre : compare les
// validations reçues de la coquille à la dernière déjà montrée sur cet
// appareil — état purement client, même patron que la pastille Accueil
// (lib/nav/feedSeen.ts), aucune colonne serveur pour ça.
//
// Premier passage (clé absente) : on retient l'instant présent sans rien
// montrer, sinon tout l'historique récent sauterait au visage d'un coup.
const VALIDATED_BETS_SEEN_STORAGE_KEY = "validated-bets-seen-at";

export function ValidatedBetsWatcher({ bets }: { bets: AdminValidatedBet[] }) {
  const showValidated = useValidatedDialog();

  useEffect(() => {
    const seenAt = window.localStorage.getItem(VALIDATED_BETS_SEEN_STORAGE_KEY);
    if (seenAt === null) {
      window.localStorage.setItem(VALIDATED_BETS_SEEN_STORAGE_KEY, new Date().toISOString());
      return;
    }

    const unseen = bets.filter((bet) => Date.parse(bet.validatedAt) > Date.parse(seenAt));
    if (unseen.length === 0) return;

    window.localStorage.setItem(VALIDATED_BETS_SEEN_STORAGE_KEY, unseen[unseen.length - 1].validatedAt);
    showValidated({
      title: unseen.length > 1 ? `${unseen.length} paris validés` : "Pari validé",
      items: unseen.map((bet) => bet.description),
      note: unseen.length > 1 ? "Validés par l'admin, ils sont en jeu." : "Validé par l'admin, il est en jeu.",
    });
  }, [bets, showValidated]);

  return null;
}
