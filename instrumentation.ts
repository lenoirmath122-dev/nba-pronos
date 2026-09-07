import * as Sentry from "@sentry/nextjs";

// Convention Next.js "instrumentation.js" (stable depuis 15.0, cf.
// node_modules/next/dist/docs/.../instrumentation.md -- vérifié avant
// d'écrire ce fichier, cf. AGENTS.md). register() charge la config Sentry
// propre à chaque runtime ; onRequestError capture toute erreur serveur
// (Server Components, Route Handlers, Server Actions), y compris celles
// jamais remontées jusqu'à app/error.tsx.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
