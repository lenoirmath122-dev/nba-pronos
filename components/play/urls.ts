// Construction d'URL partagée par PlayTabs/FilterBar/LeagueScopeChips/page.tsx
// pour l'onglet Résultats — ex-components/my-predictions/urls.ts. L'état du
// filtre vit dans l'URL, jamais dans un état client (même principe que
// l'écran Mes pronos d'origine, §4.2). Onglet Mes pronos : pas de filtres,
// pas besoin d'un builder (lien fixe "/play", cf. PlayTabs.tsx).
// Pas un composant (aucun JSX) : simple utilitaire importé par des
// composants serveur.

export const DEFAULT_LIMIT = 40;

export function buildResultsPath(params: {
  date?: string | null;
  seriesId?: string | null;
  limit?: number;
  leagueId?: string | null;
}): string {
  const sp = new URLSearchParams();
  if (params.date) sp.set("date", params.date);
  if (params.seriesId) sp.set("series", params.seriesId);
  if (params.limit && params.limit !== DEFAULT_LIMIT) sp.set("limit", String(params.limit));
  if (params.leagueId) sp.set("ligue", params.leagueId);
  const qs = sp.toString();
  return qs ? `/play/results?${qs}` : "/play/results";
}
