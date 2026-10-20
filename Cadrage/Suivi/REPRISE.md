# Reprise — NBA Pronos (21/10/2026, passation 7)
- **Livré** : accueil jouable + invités (#184, #188), e-mails 1B (#185-187), pseudo/onboarding (#176),
  crons Vercel (#191, #194), Memphis (#192), seuils inclusifs (#195), Lot 1 : **S1 (#198)** `pf` + `dreb`/`fgm`/
  `ftm`/`fta` ; **S4 (#200, #202)** `win` + combo match entier/période (`qwon`, `win_q1`..`win_h2`) ;
  **S3 + S8 (#203, mergée)** : `margin` (écart final signé : « gagne de N+ », handicap, tranches) et `starter`
  (titulaire/remplaçant, 1 joueur). Loi d'écart recalée sur `home_win` ; 5 vrais appels IA OK.
- **À faire d'abord : redéployer Cloud Run** (couvre S4 + S3/S8) : `gh workflow run deploy-stats-service.yml --ref main`.
- **Prochaine étape : Lot 1, « exactement N » / égalité exacte / score exact**, puis S2 en dernier
  (`chantiers/CHANTIER_ENRICHISSEMENT_MODELES.md`). Avant la bêta Cup du 04/12 ; Lots 2 à 4 ensuite.
- **Pièges Lot 1** : le schéma partagé `structureBet` est AU PLAFOND de grammaire de l'API : pas de nouveau
  champ, élargir un enum. Tout changement de schéma = vrais appels (test vitest jetable, `usageTracking` mocké ;
  console muette sous vitest, écrire les résultats dans un fichier). Seuils : `inclusiveThreshold.ts`.
  Nouvelle stat comptée = ne pas oublier `statSelectColumns`/`rowStatValue` (combo, duel) et les SELECT.
  Limite connue : tranche d'écart = indépendance avec les points d'équipe.
- **Après 13h Paris, en parallèle** : essai réel 1B. `/api/emails?kind=reminder&only_owner=1&force=1&dry_run=1`
  (Bearer SYNC_SECRET, `.env.local`) ; si `candidates`=1, retirer `dry_run`, vérifier réception, Resend,
  `email_log` ; remettre `email_reminders_enabled=false`. Puis recette 1B.
- **Ouvert** : 983 lignes `stats_box_scores.pf` vides (présaison), remplissage bloqué par le classificateur (accord
  requis) ; « Hauser ou Pritchard » non vérifié ; rejouer le pari Memphis `f4f3ebd6…` (coût IA, demander) ;
  poller VM (dryRun → réel) ; Réel V2 non commité ; `stash@{0}`. **Échéances** : figement hebdo 26/10 ; bêta Cup 04/12.
- **Pièges** : une branche + un worktree par PR (`node_modules` : jonction vers le checkout principal) ; le
  classificateur bloque merges/reset et écritures prod (`!`).
