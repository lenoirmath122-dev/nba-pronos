import type { Metadata } from "next";
import { Sora, Oswald } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import {
  DEFAULT_DESCRIPTION,
  HOME_TITLE,
  OG_IMAGE,
  SITE_NAME,
  SITE_URL,
  TWITTER_CARD,
} from "@/lib/seo";
import { UtmCapture } from "@/components/funnel/UtmCapture";
import "./globals.css";

// Police unique pour tout le texte de lecture (--font-ui), auto-hébergée par
// next/font — plus de hotlink Google Fonts à gérer (AJUSTEMENTS_VISUELS_20_08_2026 §2).
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

// Réservée à --font-display/--font-numeric (rangs, scores, chiffres qui
// "bougent") — condensée, registre broadcast (AJUSTEMENTS_VISUELS_20_08_2026 §9).
const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
});

// Métadonnées par défaut (Open Graph / Twitter Card p2-10, socle SEO étape C
// du 05/10/2026). Les pages publiques surchargent via `pageMetadata()`
// (lib/seo.ts) -- fusion superficielle côté Next, voir ce fichier. Pas de
// `alternates.canonical` ni d'`openGraph.url` ici : ils seraient hérités par
// TOUTES les pages et les déclareraient canoniques de la racine. Vocabulaire :
// le mot « paris » est voulu pour le référencement (décision du 05/10/2026),
// toujours avec « sans argent réel » (test lib/seo.test.ts).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: HOME_TITLE, template: `%s · ${SITE_NAME}` },
  description: DEFAULT_DESCRIPTION,
  openGraph: {
    title: HOME_TITLE,
    description: DEFAULT_DESCRIPTION,
    siteName: SITE_NAME,
    locale: "fr_FR",
    type: "website",
    images: [OG_IMAGE],
  },
  twitter: {
    card: TWITTER_CARD,
    title: HOME_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

// Thème Sombre/Clair/Photo (SPEC_ECRAN_PROFIL_V0_1 §4) : [data-theme] et
// [data-bg] s'appliquent à TOUT le site. Jusqu'au 05/11/2026 ils étaient lus
// ICI en base, ce qui imposait cookies + getUser() à chaque rendu et rendait
// tout le site dynamique (page d'accueil publique incluse, malgré son
// `revalidate`). Désormais : cookie pb-theme appliqué avant le premier rendu
// par public/theme-init.js, resynchronisé par <ThemeSync> dans le layout (app)
// -- voir lib/theme/cookie.ts. Ce layout ne lit plus aucune donnée de requête.
// `suppressHydrationWarning` : le script pose les attributs avant l'hydratation.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${sora.variable} ${oswald.variable} h-full antialiased`}
    >
      <head>
        {/* Bloquant volontairement (petit fichier, même origine, CSP 'self') :
            le thème doit être posé avant le premier affichage. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-init.js" />
      </head>
      <body className="min-h-full flex flex-col">
        <UtmCapture />
        {children}
        {/* D4/PERF (11-performances.md §5) : Web Vitals réels jamais mesurés
            faute d'accès navigateur en audit — RUM via Vercel (déploiement
            existant), aucun code de collecte à maintenir. */}
        <SpeedInsights />
        {/* Visites / pages vues (Vercel Web Analytics) : sans cookie, donc pas de
            bandeau de consentement. À activer aussi côté dashboard Vercel. */}
        <Analytics />
      </body>
    </html>
  );
}
