# Reprise — NBA Pronos (20/10/2026, passation 3)
- **Livré** : accueil jouable + invités (#184, #188), e-mails 1B (#185-187), pseudo/onboarding (#176),
  landing sans captcha (#177), Match du jour Vercel (#178-181), popup hebdo lot 5 (#170-172), crons
  heartbeat/snapshot/bracket sur Vercel (#191, #194), Memphis (#192), seuils inclusifs (#195).
- **Objectif des prochaines sessions : Lot 1 puis enchaîner** (`chantiers/CHANTIER_ENRICHISSEMENT_MODELES.md`).
  Ordre : S1 (`pf` à backfiller du SQLite local, `dreb`=reb-oreb, fgm/ftm/fta par composition), S4
  (condition générique du combo), S3 + S8, « exactement N »/égalité/score exact, S2 en dernier. Avant la
  bêta Cup du 04/12 ; Lots 2 à 4 ensuite.
- **Pièges Lot 1** : le schéma partagé `structureBet` est AU PLAFOND de grammaire de l'API (« compiled
  grammar is too large », vu par appel réel) : pas de nouveau champ, élargir un enum. Tout changement de
  schéma = vrais appels (test vitest jetable, `usageTracking` mocké). Seuils : `inclusiveThreshold.ts`.
- **Après 13h Paris, en parallèle** : essai réel 1B. `/api/emails?kind=reminder&only_owner=1&force=1&dry_run=1`
  (Bearer SYNC_SECRET, `.env.local`) ; si `candidates`=1, retirer `dry_run`, vérifier réception, Resend,
  `email_log` ; remettre `email_reminders_enabled=false`. Puis recette 1B.
- **À vérifier par l'utilisateur** : captcha Supabase ; onboarding sur téléphones ; poller VM (dryRun →
  réel) ; `weekly_ranking`/`weekly_popup` ; crons migrés exécutés sur Vercel.
- **Reste ouvert** : « Hauser ou Pritchard » (COMPARISON/OR) non vérifié ; rejouer le pari Memphis
  `f4f3ebd6…` (coût IA, demander) ; Réel V2 non commité ; `stash@{0}`. **Échéances** : figement hebdo 26/10 ;
  bêta Cup 04/12. **Pièges** : une branche + un worktree par PR ; le classificateur bloque merges/reset (`!`).
