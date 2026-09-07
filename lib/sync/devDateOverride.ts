// Override ?date=YYYY-MM-DD des routes /api/sync/schedule et /api/sync/results
// — DEV/TEST UNIQUEMENT (convenu avec l'utilisateur le 28/07/2026, correctif
// SPEC_TECHNIQUE_SYNCHRO_V0.1 §6/§12) : permet de rejouer le pipeline complet
// sur une VRAIE fenêtre de playoffs passée tant qu'on est hors saison NBA
// (aucun match réel dans l'horizon "aujourd'hui"). Le planificateur externe
// réel n'envoie JAMAIS ce paramètre — comportement de production inchangé
// (new Date(), horizon glissant). Toujours protégé en amont par le Bearer
// SYNC_SECRET (lib/sync/auth.ts) : ce n'est pas une surface ouverte.
//
// Ancré à midi UTC (pas minuit) pour éviter toute ambiguïté de bascule de
// jour America/New_York — même technique que lib/dates/paris.ts.
//
// Durci le 07/09/2026 (GAPS_OUVERTS.md, Phase 0) : jusqu'ici la seule
// protection était le Bearer SYNC_SECRET en amont — suffisant contre un tiers,
// mais le paramètre restait techniquement actif en production (n'importe qui
// détenant SYNC_SECRET, y compris un admin distrait, pouvait faire "avancer"
// la sync réelle sur une fausse date). Ignoré désormais dès que
// NODE_ENV==="production" (posé par Vercel/`next build`, jamais overridable
// par une variable d'environnement projet) — le comportement réel en
// production (new Date()) est inchangé, seul le paramètre devient inerte.
export function resolveReferenceDate(dateParam: string | null): Date {
  if (!dateParam || process.env.NODE_ENV === "production") return new Date();
  return new Date(`${dateParam}T12:00:00.000Z`);
}
