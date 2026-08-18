// TeamRef — seul reliquat de l'ancien écran Matchs (fusionné dans
// lib/queries/play.ts, SPEC_REFONTE_ONGLET_JOUER_V0_1). Ce fichier n'a PAS
// été supprimé avec le reste : TeamRef est importé par 5 modules hors du
// périmètre de la refonte (lib/queries/admin-results.ts, bets.ts,
// player-profile.ts, profile.ts, admin-missing.ts) — le déplacer casserait
// leurs imports pour un gain nul. Vérifié par grep avant suppression (§13.1
// de la spec) : aucun de ces 5 modules ne dépend de rien d'autre dans ce
// fichier, tout le reste (getMatches, MatchCard, etc.) a bien disparu.
export type TeamRef = { id: string; abbreviation: string; name: string };
