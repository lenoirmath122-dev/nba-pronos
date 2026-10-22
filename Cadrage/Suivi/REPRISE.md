# Reprise — NBA Pronos (22/10/2026, passation 12)
- **Livré** : accueil jouable + invités (#184, #188), e-mails 1B (#185-187), pseudo/onboarding (#176),
  crons Vercel (#191, #194), Memphis (#192), seuils inclusifs (#195). **Lot 1 CLOS** (#198-#206), Cloud Run redéployé, vérifié.
- **Sessions 9-10** : fond classement (#209), popup « Depuis ta dernière visite » (#210, à tester avec un vrai résultat),
  profil en panneau (#212). Accueil : carte « Prochain prono » (formulaire de /play, un seul cadre, « À faire aussi »),
  PR ouverte, recette téléphone/desktop à faire (GAPS).
- **Sessions 11-12** : /play « Mon pari » (#216, `bet_is_public`). Chat : menu ⋯ (#219), réactions emoji par appui
  long (#221, migration `chat_message_reactions` poussée en prod), CI sans doublons (#222), « Copier » + texte non
  sélectionnable (#223, à merger). Réactions non testées avec un 2e compte (Realtime).
- **Prochaine étape : Lot 2** (S6 « joue seulement N quarts » : vérifier d'abord si un quart non joué donne une
  ligne à 0 ou aucune dans `stats_box_scores_by_period` ; L8 alias de noms), voir
  `chantiers/CHANTIER_ENRICHISSEMENT_MODELES.md` (section « Lot 1 — notes de reprise » : choix de conception, écartés). Avant la bêta Cup du 04/12 ; Lots 3 et 4 ensuite.
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
