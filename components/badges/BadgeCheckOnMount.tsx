"use client";

import { useEffect } from "react";
import { requestBadgeCheck } from "@/lib/badges/checkRequest";

// Pour les gestes conclus par une redirection serveur (ligue rejointe ou
// créée, lib/actions/leagues.ts) : la coquille ne se remonte pas, c'est la
// page d'arrivée qui demande la vérification des badges (Sociable).
export function BadgeCheckOnMount() {
  useEffect(() => {
    requestBadgeCheck();
  }, []);
  return null;
}
