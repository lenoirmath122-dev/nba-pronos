import type { Metadata } from "next";

export const SITE_URL = "https://panierballon.fr";
export const SITE_NAME = "Panier Ballon";
export const TAGLINE = "Pronostics et paris NBA entre amis, sans argent réel.";
export const DEFAULT_DESCRIPTION =
  "Pronostics et paris gratuits entre amis sur la NBA : NBA Cup, playoffs, bracket et classement. Aucun argent réel, juste des points.";
export const HOME_TITLE = `${SITE_NAME} — Pronostics et paris NBA entre amis`;

// Image d'aperçu unique, partagée par le layout racine et pageMetadata() :
// Next fusionne les métadonnées de façon SUPERFICIELLE (un `openGraph` défini
// par une page remplace tout celui du layout, `images` compris), donc chaque
// page doit les reporter. Image 1200x630 -> carte "summary_large_image".
export const OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "Panier Ballon",
};
export const TWITTER_CARD = "summary_large_image" as const;

type PageMetadataInput = {
  title: string;
  description?: string;
  path: string;
  noindex?: boolean;
};

// Métadonnées d'une page publique. `title` passe par le template du layout
// racine ("%s · Panier Ballon") ; `path` sert de canonique (neutralise les
// paramètres ?tri=/?ligue=/... du classement).
export function pageMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  noindex = false,
}: PageMetadataInput): Metadata {
  const fullTitle = `${title} · ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "fr_FR",
      type: "website",
      images: [OG_IMAGE],
    },
    twitter: {
      card: TWITTER_CARD,
      title: fullTitle,
      description,
      images: [OG_IMAGE.url],
    },
    ...(noindex && { robots: { index: false, follow: false } }),
  };
}
