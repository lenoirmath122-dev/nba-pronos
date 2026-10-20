# Reprise — NBA Pronos
> Seul fichier lu en début de session. Réécrit en entier à chaque passation, 20 lignes max.
> Mis à jour le 20/10/2026 (fin de session, passation).

- **Livré** : accueil jouable + pronos invités (#184, #188), e-mails 1B + réglages (#185 à #187,
  `email_log` appliquée, Resend vérifié), pseudo + onboarding (#176), landing sans captcha (#177),
  Match du jour en cron Vercel (#178 à #181), popup hebdo lot 5 complet (#170 à #172).
- **Prochaine étape (après 13h Paris)** : essai réel 1B. `/api/emails?kind=reminder&only_owner=1&force=1&dry_run=1`
  (Bearer SYNC_SECRET, `.env.local`) ; si `candidates`=1, retirer `dry_run`, vérifier réception,
  logs Resend, `email_log`. Remettre `email_reminders_enabled=false` ensuite. Puis recette 1B
  (Gmail/Outlook/iCloud, spam, désinscription, 1 relance, ≤ 1 mail/jour).
- **À vérifier par l'utilisateur** : captcha désactivé dans Supabase ; onboarding/pseudo sur vrais
  téléphones ; poller VM (dryRun → réel) ; Reels publiés ; `weekly_ranking`/`weekly_popup` activés.
- **Reste ouvert** : correctif Memphis (`ROSTER_COUNT_KEYWORD_REGEX`) ; crons GitHub `heartbeat`,
  `snapshot-leaderboard`, `reminder-bracket` à migrer ; Réel V2 (`Cadrage/docs/reel-v2-pack/`, non
  commité) ; création auto des matchs ≥ 4 jours à vérifier.
- **Nettoyage fait** : gaps (#189), `refonte-ux` supprimée, dépôt principal sur `main`. `stash@{0}` =
  anciennes modifs locales : `git stash drop` si inutile.
- **Échéances** : figement hebdo 26/10 (« Semaine N », `reminder_log`) ; bêta Cup 04/12.
- **Pièges** : une branche + un worktree par PR depuis `origin/main` ; après une migration,
  `supabase migration list` ; le classificateur bloque merges, prod, suppressions, secrets (`!`).
