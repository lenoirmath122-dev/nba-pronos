# Reprise — NBA Pronos (21/10/2026, passation 8)
- **Livré** : accueil jouable + invités (#184, #188), e-mails 1B (#185-187), pseudo/onboarding (#176),
  crons Vercel (#191, #194), Memphis (#192), seuils inclusifs (#195). **Lot 1 CLOS** : S1 (#198), S4 (#200, #202),
  S3 + S8 (#203), « exactement N » + égalité exacte (#205), S2 corrélation entre stats d'un joueur (#206).
  Cloud Run redéployé après #206 (21/10), vérifié en réel : exactement 8 reb = 9,1 %, PRA > 40,5 = 33,7 %.
- **Écartés par décision** : score exact du match, fantasy (formule jamais choisie, aucun pari réel vu).
- **Prochaine étape : Lot 2** (S6 « joue seulement N quarts » : vérifier d'abord si un quart non joué donne une
  ligne à 0 ou aucune dans `stats_box_scores_by_period` ; L8 alias de noms), voir
  `chantiers/CHANTIER_ENRICHISSEMENT_MODELES.md`. Avant la bêta Cup du 04/12 ; Lots 3 et 4 ensuite.
- **Comment on a fait (Lot 1)** : « exactement N » = combo OVER N-0,5 + UNDER N+0,5 (prompt seul) ; égalité = DIFF_LT
  seuil 0,5 ; combo : bornes sur une même variable = intersection (`_same_variable_intersections`). Sommes : variance
  `_player_sum_variance` (ρ sur 20 matchs). Non fait : corrélation entre joueurs/équipes, total cumulé des 2 équipes
  en « exactement », minutes/pourcentages en « exactement ».
- **Pièges** : `structureBet` AU PLAFOND de grammaire (élargir un enum, pas de champ). Tout changement de schéma ou
  de prompt = vrais appels (test vitest jetable, `usageTracking` mocké, résultats écrits dans un fichier).
  Nouvelle stat comptée = `statSelectColumns`/`rowStatValue` et SELECT. Une branche + un worktree par PR
  (`node_modules` : jonction). Le classificateur bloque merges/reset/écritures prod (`!`).
- **Après 13h Paris** : essai réel 1B. `/api/emails?kind=reminder&only_owner=1&force=1&dry_run=1` (Bearer
  SYNC_SECRET) ; si `candidates`=1, retirer `dry_run`, vérifier réception, Resend, `email_log` ; remettre
  `email_reminders_enabled=false`. Puis recette 1B.
- **Ouvert** : 983 lignes `stats_box_scores.pf` vides (accord requis) ; « Hauser ou Pritchard » non vérifié ; rejouer
  le pari Memphis `f4f3ebd6…` (coût IA, demander) ; poller VM (dryRun → réel) ; instabilité des probas (conversation
  à part) ; Réel V2 non commité ; `stash@{0}`. **Échéances** : figement hebdo 26/10 ; bêta Cup 04/12.
