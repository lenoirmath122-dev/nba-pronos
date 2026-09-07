import * as Sentry from "@sentry/nextjs";

// Convention Next.js "instrumentation-client.js" (depuis 15.3, cf.
// node_modules/next/dist/docs -- vérifié avant d'écrire ce fichier, cf.
// AGENTS.md) -- remplace l'ancien sentry.client.config.ts des versions
// précédentes du SDK. Pas de Session Replay ici (volontaire) : pas justifié
// pour une app de ce trafic, coût de quota Sentry et d'empreinte vie privée
// pour un gain marginal sur ce projet -- à ajouter séparément si le besoin
// se confirme.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});

// Requis par le SDK (avertissement de build sinon) : trace les navigations
// App Router comme des spans de performance.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
