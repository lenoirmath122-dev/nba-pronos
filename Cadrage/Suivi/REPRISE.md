# Reprise — NBA Pronos

> Seul fichier lu en début de session. Réécrit en entier à chaque passation, 20 lignes max.
> Mis à jour le 20/10/2026 (nettoyage des gaps contre `origin/main`).

- **Livré et mergé** : accueil jouable + pronos invités (#184, #188), e-mails 1B + réglages
  (#185 à #187, migration `email_log` appliquée, Resend vérifié), pseudo + onboarding (#176),
  landing sans captcha (#177), Match du jour en cron Vercel (#178 à #181), popup hebdo lot 5
  complet (#170 à #172).
- **Prochaine étape (20/10, après 13h Paris)** : essai réel 1B. `/api/emails?kind=reminder&only_owner=1&force=1&dry_run=1`
  (Bearer SYNC_SECRET dans `.env.local`) ; si `candidates`=1, retirer `dry_run`, vérifier
  réception, logs Resend et `email_log`. Remettre `email_reminders_enabled=false` ensuite.
- **Puis** : recette 1B (Gmail/Outlook/iCloud, spam, désinscription, 1 relance, ≤ 1 mail/jour).
- **À vérifier par l'utilisateur** (non vérifiable depuis le code) : captcha désactivé dans
  Supabase ; onboarding/pseudo sur vrais téléphones ; VM poller (dryRun → réel) ; Reels
  publiés ; `weekly_ranking`/`weekly_popup` activés ; Vercel autorise tous les crons.
- **Reste ouvert** : correctif Memphis (`ROSTER_COUNT_KEYWORD_REGEX`) ; crons GitHub `heartbeat`,
  `snapshot-leaderboard`, `reminder-bracket` à migrer ; Réel V2 (`Cadrage/docs/reel-v2-pack/`,
  dépôt principal, non commité) ; création auto des matchs ≥ 4 jours à vérifier.
- **Nettoyage local** : le dépôt principal est sur `feat/popup-hebdo-pipeline` (mergée, 51 commits
  de retard) avec des modifs de suivi non commitées ; branche `refonte-ux` (non poussée) à supprimer.
- **Échéances** : saison NBA 20/10 ; figement hebdo 26/10 (vérifier « Semaine N », `reminder_log`) ;
  bêta Cup 04/12.
- **Pièges** : une branche + un worktree par PR depuis `origin/main` ; après merge d'une migration,
  `supabase migration list` ; le classificateur bloque merges, déploiements prod, suppressions
  locales et écritures de secrets (utiliser `!`) ; jamais de secret affiché.
