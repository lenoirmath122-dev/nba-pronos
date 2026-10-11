// Liens et choix de vue de l'écran Classement (lot 2 du classement hebdo).
// Module pur, importable depuis des composants client comme serveur.
//
// `?vue=semaine|general` : n'existe que quand le classement hebdo est actif
// sur la compétition. Sans `vue`, un lien historique `?tri=…`/`?ordre=…`
// continue d'ouvrir la vue Générale (ces paramètres n'existent que là) ;
// sans aucun paramètre, la vue Semaine est la vue par défaut.

export type LeaderboardView = "semaine" | "general";

type Param = string | string[] | undefined;

function isFilled(value: Param): boolean {
  return typeof value === "string" && value.length > 0;
}

export function parseView(vue: Param, tri: Param, ordre: Param, weeklyActive: boolean): LeaderboardView {
  if (!weeklyActive) return "general";
  if (vue === "semaine" || vue === "general") return vue;
  return isFilled(tri) || isFilled(ordre) ? "general" : "semaine";
}

type HrefInput = {
  vue?: LeaderboardView;
  /** Omis de l'URL quand c'est "total" (repli par défaut). */
  tri?: string;
  /** Omis de l'URL sauf "asc" (repli par défaut : desc). */
  ordre?: "asc" | "desc";
  ligue?: string | null;
};

export function leaderboardHref({ vue, tri, ordre, ligue }: HrefInput): string {
  const params = new URLSearchParams();
  if (vue) params.set("vue", vue);
  if (tri && tri !== "total") params.set("tri", tri);
  if (ordre === "asc") params.set("ordre", "asc");
  if (ligue) params.set("ligue", ligue);
  const query = params.toString();
  return query ? `/leaderboard?${query}` : "/leaderboard";
}
