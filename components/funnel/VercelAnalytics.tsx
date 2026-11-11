"use client";

import { Analytics } from "@vercel/analytics/next";
import { isInternalVisitor } from "@/lib/funnel/track";

// Vercel Web Analytics sans les visites des admins : le hub admin pose le
// cookie pb_internal (InternalVisitorMark), et tout navigateur qui le porte
// n'envoie plus rien à Vercel. `beforeSend` est une fonction, donc ce composant
// doit être client (le layout racine est un composant serveur).
export function VercelAnalytics() {
  return <Analytics beforeSend={(event) => (isInternalVisitor() ? null : event)} />;
}
