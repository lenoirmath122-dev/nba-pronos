import type { MetadataRoute } from "next";

// Manifest PWA — nécessaire pour l'installation sur écran d'accueil iOS/Android
// (backlog "Rappels ciblés", canal Push, §2.46 ETAT_ACTUEL.md) : sur iOS, les
// notifications web ne fonctionnent QUE depuis une app installée à l'écran
// d'accueil (restriction Apple, jamais dans un onglet Safari/Chrome classique).
// Icônes placeholder (monogramme "NP", public/icons/README-style) — à
// remplacer par un vrai logo si besoin, aucun impact sur le fonctionnement.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NBA Pronos",
    short_name: "NBA Pronos",
    description: "Pronostics et paris entre amis sur les playoffs NBA.",
    start_url: "/home",
    display: "standalone",
    background_color: "#0B0E14",
    theme_color: "#0B0E14",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
