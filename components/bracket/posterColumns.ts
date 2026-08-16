// Géométrie du poster (Ouest | Finale NBA | Est), extraite le 16/08/2026
// (chantier « remplissage en poster interactif ») de
// SeriesDrillDown.tsx::buildMirroredColumns — jusque-là privée à ce
// fichier, typée sur BracketNode/BracketRound (lib/queries/bracket.ts).
// Généralisée ici pour être partagée avec le remplissage
// (BracketFillSeries/BracketFillRound, lib/queries/bracket-fill.ts), qui a
// exactement la même topologie (Ouest ascendant 1er tour -> demies ->
// finale de conf., Finale NBA au centre, Est descendant miroir) mais un
// type de série différent — d'où `items` (nom neutre) plutôt que
// `nodes`/`series`, propriété propre à chaque domaine, jamais partagée par
// ce module.
//
// Aucune dépendance de comportement ici : purement structurel (regroupe et
// ordonne), le rendu et l'interactivité restent entièrement du ressort de
// chaque appelant.

export type PosterRound<T> = { key: string; label: string; items: T[] };

// `side` : direction du trait de connexion vers la colonne suivante (voir
// TreeConnectors.tsx) — "west" pousse vers la droite (1er tour -> Finale),
// "east" vers la gauche (miroir du poster). Le centre (Finale NBA) n'a pas
// de colonne suivante, son `side` n'est donc jamais lu.
export type PosterColumn<T> = { key: string; label: string; items: T[]; side: "west" | "east" };

type ConferenceItem = { conference: "EAST" | "WEST" | null };

const PLAYOFF_ROUND_ORDER = ["ROUND_1", "CONF_SEMIS", "CONF_FINALS"] as const;

export function buildMirroredPosterColumns<T extends ConferenceItem>(rounds: PosterRound<T>[]): PosterColumn<T>[] {
  const byKey = new Map(rounds.map((r) => [r.key, r]));
  const finals = byKey.get("NBA_FINALS");

  const west: PosterColumn<T>[] = PLAYOFF_ROUND_ORDER.map((key) => {
    const round = byKey.get(key);
    return {
      key: `${key}-WEST`,
      label: round ? `${round.label} — Ouest` : "Ouest",
      items: round?.items.filter((item) => item.conference === "WEST") ?? [],
      side: "west" as const,
    };
  });

  const east: PosterColumn<T>[] = [...PLAYOFF_ROUND_ORDER]
    .reverse()
    .map((key) => {
      const round = byKey.get(key);
      return {
        key: `${key}-EAST`,
        label: round ? `${round.label} — Est` : "Est",
        items: round?.items.filter((item) => item.conference === "EAST") ?? [],
        side: "east" as const,
      };
    });

  const center: PosterColumn<T> = {
    key: "NBA_FINALS",
    label: finals?.label ?? "Finale NBA",
    items: finals?.items ?? [],
    side: "west",
  };

  return [...west, center, ...east];
}
