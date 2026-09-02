import { z } from "zod";

// Schémas zod partagés pour les Server Actions (audit de sécurité,
// security-audit-report.md finding 5) — la validation manuelle existante
// (longueur max, enums fermés) était correcte mais dispersée, ad hoc par
// fichier, sans schéma centralisé pour signaler un oubli en cas d'ajout
// futur. Les contraintes RLS/CHECK en base (`supabase/migrations/*`)
// restent l'autorité réelle (défense en profondeur) : ces schémas ajoutent
// une couche de validation applicative typée, échouant tôt côté serveur
// AVANT tout appel réseau vers Postgres.

export const ThemePreferenceSchema = z.enum(["LIGHT", "DARK", "PHOTO"]);
export const BackgroundThemeSchema = z.enum(["MURAL", "HOOP", "HK"]);

/** Texte libre optionnel (ex. bio) : borné, `null`/vide devient `null`. */
export function optionalBoundedText(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .nullable()
    .transform((v) => (v === "" || v === null ? null : v));
}

/** Texte libre requis (ex. description de signalement) : non-vide après trim, borné. */
export function requiredBoundedText(maxLength: number) {
  return z.string().trim().min(1).max(maxLength);
}

/** Texte libre borné SANS règle de vacuité (le champ peut être vide selon
 *  l'appelant, ex. description de pari en brouillon, justification déjà
 *  vérifiée non-vide côté fonction SQL SECURITY DEFINER) — pas de `.trim()`
 *  non plus, pour ne pas changer la valeur stockée par rapport au
 *  comportement actuel de ces champs. */
export function boundedText(maxLength: number) {
  return z.string().max(maxLength);
}
