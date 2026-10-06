import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Pages publiques indexables uniquement (pas de /players*, pas des pages
// d'authentification secondaires, pas de zone privée). `lastModified` est une
// date par page, à mettre à jour à la main quand CETTE page change :
// `new Date()` changerait à chaque build sans refléter de vraie modification,
// et une date commune ferait mentir toutes les pages à chaque retouche.

const PAGES: {
  path: string;
  lastModified: string;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
  priority: number;
}[] = [
  {
    path: "/",
    lastModified: "2026-10-06",
    changeFrequency: "weekly",
    priority: 1,
  },
  {
    path: "/regles",
    lastModified: "2026-10-06",
    changeFrequency: "monthly",
    priority: 0.8,
  },
  {
    path: "/leaderboard",
    lastModified: "2026-10-06",
    changeFrequency: "daily",
    priority: 0.7,
  },
  {
    path: "/bracket",
    lastModified: "2026-10-06",
    changeFrequency: "daily",
    priority: 0.7,
  },
  {
    path: "/signup",
    lastModified: "2026-10-06",
    changeFrequency: "yearly",
    priority: 0.6,
  },
  {
    path: "/login",
    lastModified: "2026-10-06",
    changeFrequency: "yearly",
    priority: 0.3,
  },
  {
    path: "/cgu",
    lastModified: "2026-10-06",
    changeFrequency: "yearly",
    priority: 0.2,
  },
  {
    path: "/mentions-legales",
    lastModified: "2026-10-06",
    changeFrequency: "yearly",
    priority: 0.2,
  },
  {
    path: "/confidentialite",
    lastModified: "2026-10-06",
    changeFrequency: "yearly",
    priority: 0.2,
  },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((p) => ({
    url: `${SITE_URL}${p.path}`,
    lastModified: new Date(p.lastModified),
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
