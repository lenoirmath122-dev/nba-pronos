import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs/config";

// connect-src doit couvrir le VRAI Supabase utilisé, pas seulement le
// domaine hébergé de prod -- en local/CI (e2e, Playwright), NEXT_PUBLIC_
// SUPABASE_URL pointe vers http://127.0.0.1:54321 (Supabase CLI), qui ne
// matche jamais "https://*.supabase.co". Avec ce wildcard figé, la CSP
// bloquait SILENCIEUSEMENT tout appel d'auth du navigateur en dev (aucune
// erreur réseau visible pour l'utilisateur -- juste un bouton "Connexion…"
// qui ne se débloque jamais), détecté en essayant de faire tourner e2e sur
// un nouveau projet Playwright (07/09/2026). Calculé dynamiquement à partir
// de la même variable que le reste de l'app, jamais codé en dur deux fois.
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : "https://*.supabase.co";
const supabaseWsOrigin = supabaseOrigin.replace(/^http/, "ws");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Vercel gère TLS/HTTPS nativement mais n'ajoute pas ce header par défaut
  // (audit sécurité 29/08/2026, finding "Absence de headers de sécurité
  // HTTP"). max-age 2 ans + preload : aucun sous-domaine HTTP n'existe.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Aucune de ces API n'est utilisée par l'app aujourd'hui (pas de caméra/
  // micro/géoloc/paiement web) — désactivées par défaut, à revoir si un
  // besoin réel apparaît (ex. Stripe en Phase 5 pourrait nécessiter payment=()
  // assoupli pour son propre frame).
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // https://challenges.cloudflare.com : script du widget CAPTCHA Turnstile
      // (audit de sécurité, finding 3, 02/09/2026) -- ajouté en script-src ET
      // frame-src, le widget se rend dans un iframe cross-origin.
      // 'unsafe-eval' UNIQUEMENT en dev (jamais en prod, cf. NODE_ENV
      // ci-dessous) : React s'en sert pour reconstruire des stack traces
      // lisibles en mode dev (Fast Refresh) -- absent, chaque montage de
      // composant loggait "eval() is not supported in this environment"
      // dans la console (constaté 09/09/2026), sans casser l'app (React
      // n'utilise jamais eval() en production, le message le dit lui-même).
      `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      // https://*.sentry.io : découvert manquant en creusant le flake e2e
      // ci-dessus (07/09/2026) -- le sous-domaine d'ingestion est propre à
      // l'organisation/région (ex. o<id>.ingest.de.sentry.io), wildcardé
      // plutôt que figé au cas où Sentry le fasse évoluer. Sans cette ligne,
      // Sentry.captureException() côté NAVIGATEUR (instrumentation-client.ts)
      // était bloqué depuis son intégration (PR #50) -- jamais remarqué car
      // la vérification de bout en bout avait utilisé une route API (erreur
      // CÔTÉ SERVEUR, jamais soumise à la CSP du navigateur).
      `connect-src 'self' ${supabaseOrigin} ${supabaseWsOrigin} https://api.anthropic.com https://challenges.cloudflare.com https://*.sentry.io`,
      "frame-src https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Racine forcée : un package.json/package-lock.json parasites dans
  // C:\dev\ (dossier parent partagé avec d'autres projets) faisaient
  // remonter Turbopack jusque là pour détecter la racine du projet,
  // cassant la résolution des routes de l'app (toutes les pages en 404
  // sauf la redirection de "/", constaté le 02/09/2026).
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

// org/project/authToken absents volontairement (07/09/2026) : pas de compte
// CI/token créé pour l'instant, ce qui désactive juste l'upload des source
// maps (stack traces minifiées en prod) -- la capture d'erreurs elle-même
// fonctionne sans ça. À ajouter plus tard (SENTRY_ORG/SENTRY_PROJECT/
// SENTRY_AUTH_TOKEN) si des traces lisibles deviennent nécessaires.
export default withSentryConfig(nextConfig, {
  silent: true,
});
