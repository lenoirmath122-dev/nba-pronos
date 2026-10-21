"use server";

import { getResultsSince, type FeedItem } from "@/lib/queries/home";

// Popup « depuis ta dernière visite » : la lecture se fait à la demande du
// client, qui fournit son propre repère « vu » (localStorage, par appareil,
// comme la pastille Accueil — lib/nav/feedSeen.ts). Plafonds : on ne remonte
// pas au-delà de 14 jours (appareil retrouvé après une longue absence) ni
// au-delà de 30 lignes.
const MAX_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_ITEMS = 30;

export type ActivityRecap = {
  /** Instant de la lecture : le client le retient comme nouveau repère, ce qui
   *  évite de perdre un résultat tombé entre la lecture et l'écriture. */
  asOf: string;
  items: FeedItem[];
};

export async function getActivityRecap(sinceIso: string): Promise<ActivityRecap | null> {
  const asOf = new Date();
  const sinceMs = Date.parse(sinceIso);
  if (Number.isNaN(sinceMs)) return null;
  const since = new Date(Math.max(sinceMs, asOf.getTime() - MAX_LOOKBACK_MS)).toISOString();

  const items = await getResultsSince(since, MAX_ITEMS);
  return { asOf: asOf.toISOString(), items };
}
