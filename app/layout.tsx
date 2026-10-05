import type { Metadata } from "next";
import { Sora, Oswald } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_DESCRIPTION,
  HOME_TITLE,
  OG_IMAGE,
  SITE_NAME,
  SITE_URL,
  TWITTER_CARD,
} from "@/lib/seo";
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

type SitePreferences = {
  theme: "LIGHT" | "DARK" | "PHOTO";
  backgroundTheme: "MURAL" | "HOOP" | "HK";
};

// Thème Sombre/Clair/Photo (SPEC_ECRAN_PROFIL_V0_1 §4, 3e valeur ajoutée le
// 06/08/2026 — cf. migrations 20260806100000/20260806110000) : câblage
// explicitement laissé en attente par app/tokens.css pour le thème (« la
// bascule est un lot séparé »). Lus ENSEMBLE ICI (racine, hors des deux
// route groups, une seule requête) car [data-theme="..."] et [data-bg="..."]
// s'appliquent à TOUT le site, visiteur non connecté inclus (/login,
// /leaderboard...). Un visiteur sans session reste sur les défauts
// (DARK / MURAL, mêmes valeurs que les défauts colonne ET CSS sur :root) —
// aucune préférence à lire pour lui.
async function getSitePreferences(): Promise<SitePreferences> {
  const DEFAULTS: SitePreferences = { theme: "DARK", backgroundTheme: "MURAL" };

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEFAULTS;

  const { data } = await supabase
    .from("users")
    .select("theme_preference, background_theme")
    .eq("id", user.id)
    .single<{ theme_preference: "LIGHT" | "DARK" | "PHOTO"; background_theme: "MURAL" | "HOOP" | "HK" }>();

  if (!data) return DEFAULTS;
  return { theme: data.theme_preference, backgroundTheme: data.background_theme };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { theme, backgroundTheme } = await getSitePreferences();

  return (
    <html
      lang="fr"
      data-theme={theme === "LIGHT" ? "light" : theme === "PHOTO" ? "photo" : undefined}
      data-bg={theme === "PHOTO" && backgroundTheme !== "MURAL" ? backgroundTheme.toLowerCase() : undefined}
      className={`${sora.variable} ${oswald.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* D4/PERF (11-performances.md §5) : Web Vitals réels jamais mesurés
            faute d'accès navigateur en audit — RUM via Vercel (déploiement
            existant), aucun code de collecte à maintenir. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
