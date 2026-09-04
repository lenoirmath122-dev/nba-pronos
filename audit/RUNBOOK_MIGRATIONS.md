# Séquencement migration / déploiement

Garde-fou de `audit/PLAN_ACTION.md` — B5 (`OPS-004`), 04/09/2026.

## Le risque

Vercel déploie automatiquement le code à chaque merge sur `main`. Les
migrations Supabase (`supabase/migrations/`), elles, ne se poussent PAS
automatiquement sur le projet hébergé -- `npx supabase db push` est une
étape manuelle séparée. Rien n'empêche aujourd'hui de merger une PR dont le
code suppose une colonne/table/fonction créée par une migration qui n'a pas
encore été poussée : le déploiement Vercel passe, et le code casse en
production au premier appel qui touche le schéma manquant.

## La règle

Avant de merger une PR qui ajoute une migration dans `supabase/migrations/`
**et** du code qui en dépend :

1. Vérifier ce qui est déjà poussé sur le projet hébergé :
   ```
   npx supabase migration list
   ```
   Une ligne avec `remote` vide = pas encore poussée.
2. Pousser la migration AVANT de merger le code qui en dépend :
   ```
   npx supabase db push
   ```
3. Seulement ensuite, merger/déployer le code.

Alternative si l'ordre ci-dessus n'est pas praticable (ex. migration et code
mergés dans la même PR, revue avant push) : écrire la migration de façon
**additive et rétrocompatible** (nouvelle colonne nullable, nouvelle
fonction, jamais un `drop`/`not null` sans défaut) pour que le code déployé
AVANT le push ne casse pas -- le code qui dépend de la nouveauté attend
simplement que la migration suive.

## Rappel

`npx supabase db push` exige Docker + la CLI Supabase configurée en local
(ou peut se faire depuis le dashboard Supabase, SQL Editor, si Docker n'est
pas disponible) -- même prérequis que `npm run test:integration` (A4, voir
`test/integration/`).
