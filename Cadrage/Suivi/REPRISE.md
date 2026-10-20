# Reprise — NBA Pronos (20/10/2026, passation 2)
- **Livré** : accueil jouable + pronos invités (#184, #188), e-mails 1B + réglages (#185 à #187,
  `email_log` appliquée, Resend vérifié), pseudo + onboarding (#176), landing sans captcha (#177),
  Match du jour en cron Vercel (#178 à #181), popup hebdo lot 5 (#170 à #172), crons `heartbeat` /
  `snapshot-leaderboard` / `reminder-bracket` sur Vercel (#191), correctif Memphis (#192).
- **Prochaine étape (après 13h Paris)** : essai réel 1B. `/api/emails?kind=reminder&only_owner=1&force=1&dry_run=1`
  (Bearer SYNC_SECRET, `.env.local`) ; si `candidates`=1, retirer `dry_run`, vérifier réception,
  logs Resend, `email_log`; remettre `email_reminders_enabled=false`. Puis recette 1B (Gmail/Outlook/
  iCloud, spam, désinscription, 1 relance, ≤ 1 mail/jour).
- **Ensuite : enrichissement des modèles** — plan existant : `chantiers/CHANTIER_ENRICHISSEMENT_MODELES.md`
  (+ `Cadrage/Fonctionnel/nba_pronos_cadrage_enrichissement_modeles_paris.md`). Reste : rejouer le pari
  Memphis `f4f3ebd6…` (coût IA, demander d'abord) ; « N ou plus » décalé de 1 (`OVER 11` strict) ;
  Lot 1 (S1, S2, S4, S3, S8…) avant la bêta du 04/12.
- **À vérifier par l'utilisateur** : captcha désactivé dans Supabase ; onboarding/pseudo sur vrais
  téléphones ; poller VM (dryRun → réel) ; Reels publiés ; `weekly_ranking`/`weekly_popup` activés ;
  les 3 crons migrés s'exécutent bien sur Vercel.
- **Reste ouvert** : Réel V2 (`Cadrage/docs/reel-v2-pack/`, non commité) ; création auto des matchs
  ≥ 4 jours à vérifier ; `stash@{0}` à drop si inutile. **Échéances** : figement hebdo 26/10 ; bêta Cup 04/12.
- **Pièges** : une branche + un worktree par PR depuis `origin/main` ; après une migration,
  `supabase migration list` ; le classificateur bloque merges, prod, suppressions (`!`).
