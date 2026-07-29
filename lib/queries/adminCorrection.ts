// Marquage de correction admin, NOMINATIF (SPEC_ECRAN_MES_PRONOS_V0_1.md §7.1)
// — partagé par lib/queries/matches.ts et lib/queries/my-predictions.ts.
// Extrait dans un fichier séparé (plutôt qu'un import croisé entre les deux
// modules d'écran) pour éviter une dépendance circulaire : my-predictions.ts
// importe déjà TeamRef depuis matches.ts.
export type AdminCorrection = {
  adminName: string;
  reason: string | null;
};

export function toAdminCorrection(
  correctedByAdminId: string | null,
  reason: string | null,
  pseudoById: Map<string, string>
): AdminCorrection | null {
  if (!correctedByAdminId) return null;
  return { adminName: pseudoById.get(correctedByAdminId) ?? "", reason };
}
