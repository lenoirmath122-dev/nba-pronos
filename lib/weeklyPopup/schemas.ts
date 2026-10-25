import { z } from "zod";

// Schémas Zod des sorties LLM de la popup hebdomadaire (lot 5, plan §3.7-3.8).
// Miroirs de `Cadrage/Fonctionnel/popup_hebdo/schema_sortie_v6.json` et
// `schema_classifieur_v1.json`. Ne couvrent que la STRUCTURE ; les contrôles
// qui dépendent des candidats (ids connus, mentions, blocs null, seuils de
// mots) sont dans `validateOutput` (PR 3), et la cohérence verdict/catégorie
// du classifieur est vérifiée par candidat (`isVerdictCoherent`) pour qu'un
// seul verdict incohérent ne fasse pas tomber tout le lot.

const nullableText = (max: number) => z.string().min(1).max(max).nullable();

/** Ids du rédacteur : préfixe de bloc t/f/r (le champion n'est jamais cité par id). */
const citedIds = z
  .array(z.string().regex(/^[tfr]\d{1,3}$/))
  .max(8)
  .refine((ids) => new Set(ids).size === ids.length, "ids en doublon");

export const RedacteurOutputSchema = z
  .object({
    titre: z.string().min(1).max(100),
    champion: nullableText(350),
    // v6 ; absent toléré (vaut null) pour ne pas relancer un appel pour si peu.
    classement: nullableText(800).optional(),
    top: nullableText(700),
    flop: nullableText(700),
    refuse: nullableText(450),
    cta: z.string().min(1).max(150),
    paris_cites: z
      .object({ top: citedIds, flop: citedIds, refuse: citedIds })
      .strict(),
  })
  .strict();
export type RedacteurOutput = z.infer<typeof RedacteurOutputSchema>;

export const CLASSIFIER_CATEGORIES = ["racisme", "discrimination", "manipulation", "doute"] as const;

export const ClassifierVerdictSchema = z
  .object({
    id: z.string().regex(/^[a-z]\d{1,3}$/),
    verdict: z.enum(["ok", "bloque"]),
    categorie: z.enum(CLASSIFIER_CATEGORIES).nullable(),
  })
  .strict();
export type ClassifierVerdict = z.infer<typeof ClassifierVerdictSchema>;

export const ClassifierOutputSchema = z
  .object({ verdicts: z.array(ClassifierVerdictSchema).min(1).max(40) })
  .strict();
export type ClassifierOutput = z.infer<typeof ClassifierOutputSchema>;

/** `categorie` est NULL si et seulement si le verdict est `ok`. */
export function isVerdictCoherent(v: ClassifierVerdict): boolean {
  return v.verdict === "ok" ? v.categorie === null : v.categorie !== null;
}
