import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Zones privées et pages techniques exclues. /players n'est PAS en Disallow :
// un Disallow empêcherait le robot de lire leur `noindex` (voir leurs
// métadonnées), et une URL déjà liée pourrait être indexée sans contenu.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/home",
        "/play",
        "/profile",
        "/admin",
        "/chat",
        "/mfa-challenge",
        "/mfa-setup",
        "/api/",
        "/reset-password",
        "/verify-email",
        "/email-confirmed",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
