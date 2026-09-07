import type { NextConfig } from "next";
import path from "path";

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
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://challenges.cloudflare.com",
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

export default nextConfig;
