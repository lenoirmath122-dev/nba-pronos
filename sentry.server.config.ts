import * as Sentry from "@sentry/nextjs";

// Chargé par instrumentation.ts pour le runtime Node.js (register(), cf. doc
// Next.js "instrumentation.js" -- fichier séparé requis par convention
// @sentry/nextjs, jamais importé ailleurs).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Échantillonnage de performance (spans), pas les erreurs -- toutes les
  // erreurs sont toujours capturées quel que soit ce taux. 10% en prod
  // suffit largement au volume de cette app (cercle fermé d'amis) sans
  // consommer inutilement le quota gratuit.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});
