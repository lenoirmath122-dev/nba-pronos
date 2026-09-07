import * as Sentry from "@sentry/nextjs";

// Chargé par instrumentation.ts pour le runtime Edge -- proxy.ts (aucun
// runtime déclaré explicitement, donc Edge par défaut) tourne dessus.
// Fichier séparé requis par convention @sentry/nextjs, jamais importé
// ailleurs.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});
