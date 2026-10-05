import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Pages publiques indexables uniquement (pas de /players*, pas des pages
// d'authentification secondaires, pas de zone privée). `lastModified` fixe :
// `new Date()` changerait à chaque build sans refléter de vraie modification.
const LAST_MODIFIED = new Date("2026-10-05");

const PAGES: {
  path: string;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
  priority: number;
}[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/regles", changeFrequency: "monthly", priority: 0.8 },
  { path: "/leaderboard", changeFrequency: "daily", priority: 0.7 },
  { path: "/bracket", changeFrequency: "daily", priority: 0.7 },
  { path: "/signup", changeFrequency: "yearly", priority: 0.6 },
  { path: "/login", changeFrequency: "yearly", priority: 0.3 },
  { path: "/cgu", changeFrequency: "yearly", priority: 0.2 },
  { path: "/mentions-legales", changeFrequency: "yearly", priority: 0.2 },
  { path: "/confidentialite", changeFrequency: "yearly", priority: 0.2 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((p) => ({
    url: `${SITE_URL}${p.path}`,
    lastModified: LAST_MODIFIED,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
