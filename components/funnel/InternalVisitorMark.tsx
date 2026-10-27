"use client";

import { useEffect } from "react";
import { INTERNAL_COOKIE } from "@/lib/funnel/events";

// Rendu uniquement dans le hub admin (déjà réservé aux admins) : marque ce
// navigateur pour que ses visites ne soient plus mesurées (1 an).
export function InternalVisitorMark() {
  useEffect(() => {
    document.cookie = `${INTERNAL_COOKIE}=1; Max-Age=31536000; Path=/; SameSite=Lax`;
  }, []);
  return null;
}
