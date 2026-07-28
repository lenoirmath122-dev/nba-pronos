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
export function resolveReferenceDate(dateParam: string | null): Date {
  if (!dateParam) return new Date();
  return new Date(`${dateParam}T12:00:00.000Z`);
}
