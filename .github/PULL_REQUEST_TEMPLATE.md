## Résumé



## Migration Supabase

- [ ] Cette PR n'ajoute ni ne modifie de fichier dans `supabase/migrations/`
- [ ] Cette PR ajoute une migration -- elle est déjà poussée sur le projet Supabase hébergé (`npx supabase migration list` / `npx supabase db push`) **avant** de merger cette PR, ou le code est écrit pour tolérer le décalage. Voir `audit/RUNBOOK_MIGRATIONS.md`.

## Tests

- [ ] `npm test` passe
- [ ] `npx tsc --noEmit` passe
