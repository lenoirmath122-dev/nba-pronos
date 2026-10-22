// Registre unique de la navigation du panneau admin : les 4 rubriques, la
// rubrique parente et le libellé de chaque écran. Sert aux pages de rubrique
// (liste de liens) ET au lien retour de l'en-tête (AdminBackLink).

export type AdminSectionSlug = "todo" | "game" | "community" | "system";

export type AdminSection = { slug: AdminSectionSlug; label: string; href: string };

export const ADMIN_HOME = { href: "/admin", label: "Tableau de bord" } as const;

export const ADMIN_SECTIONS: Record<AdminSectionSlug, AdminSection> = {
  todo: { slug: "todo", label: "À traiter", href: "/admin/todo" },
  game: { slug: "game", label: "Jeu", href: "/admin/game" },
  community: { slug: "community", label: "Joueurs", href: "/admin/community" },
  system: { slug: "system", label: "Système", href: "/admin/system" },
};

export const ADMIN_SECTION_LIST: AdminSection[] = [
  ADMIN_SECTIONS.todo,
  ADMIN_SECTIONS.game,
  ADMIN_SECTIONS.community,
  ADMIN_SECTIONS.system,
];

// Écran -> libellé et parent du lien retour. Popup : parent = Jeu (son
// compteur apparaît aussi dans À traiter).
export const ADMIN_SCREENS: Record<string, { label: string; parent: string }> = {
  "/admin/validation": { label: "Paris à valider", parent: "/admin/todo" },
  "/admin/resolution": { label: "Paris à résoudre", parent: "/admin/todo" },
  "/admin/requests": { label: "Requêtes de correction", parent: "/admin/todo" },
  "/admin/pseudo": { label: "Changements de pseudo", parent: "/admin/todo" },
  "/admin/bug-reports": { label: "Signalements", parent: "/admin/todo" },
  "/admin/chat-reports": { label: "Signalements de chat", parent: "/admin/todo" },
  "/admin/popup": { label: "Popup hebdo", parent: "/admin/game" },
  "/admin/competitions": { label: "Compétitions", parent: "/admin/game" },
  "/admin/competitions/new": { label: "Nouvelle compétition", parent: "/admin/competitions" },
  "/admin/competitions/results": { label: "Saisie des résultats", parent: "/admin/competitions" },
  "/admin/missing": { label: "Qui manque à l'appel", parent: "/admin/game" },
  "/admin/players": { label: "Gestion des joueurs", parent: "/admin/community" },
  "/admin/logs": { label: "Historique des logs", parent: "/admin/system" },
  "/admin/sync-logs": { label: "Logs de synchronisation", parent: "/admin/system" },
  "/admin/security": { label: "Sécurité du compte", parent: "/admin/system" },
};

// Écrans listés par rubrique, dans l'ordre d'affichage. « À traiter » est
// construit à part (compteurs) mais ses écrans sont déclarés ici pour la
// vérification « aucun orphelin ».
export const ADMIN_SECTION_SCREENS: Record<AdminSectionSlug, string[]> = {
  todo: [
    "/admin/validation",
    "/admin/resolution",
    "/admin/requests",
    "/admin/pseudo",
    "/admin/popup",
    "/admin/bug-reports",
    "/admin/chat-reports",
  ],
  game: [
    "/admin/competitions",
    "/admin/competitions/new",
    "/admin/competitions/results",
    "/admin/popup",
    "/admin/missing",
  ],
  community: ["/admin/players"],
  system: ["/admin/logs", "/admin/sync-logs", "/admin/security"],
};

export function screenLabel(href: string): string {
  return ADMIN_SCREENS[href]?.label ?? href;
}

// Cible du lien retour pour un chemin donné ; null sur /admin. Un chemin
// inconnu (sous-route dynamique) remonte au plus proche ancêtre enregistré.
export function getAdminBackTarget(pathname: string): { href: string; label: string } | null {
  const path = pathname.replace(/\/+$/, "");
  if (path === "" || path === ADMIN_HOME.href) return null;

  const section = ADMIN_SECTION_LIST.find((s) => s.href === path);
  if (section) return ADMIN_HOME;

  const screen = ADMIN_SCREENS[path];
  if (screen) return { href: screen.parent, label: parentLabel(screen.parent) };

  const up = path.slice(0, path.lastIndexOf("/"));
  return up.startsWith(ADMIN_HOME.href) && up !== path ? getAdminBackTarget(up) ?? ADMIN_HOME : ADMIN_HOME;
}

function parentLabel(href: string): string {
  return ADMIN_SECTION_LIST.find((s) => s.href === href)?.label ?? screenLabel(href);
}
