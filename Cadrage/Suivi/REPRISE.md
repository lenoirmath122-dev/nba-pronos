# Reprise — NBA Pronos (20/10/2026, passation 4)
- **Livré** : accueil jouable + invités (#184, #188), e-mails 1B (#185-187), pseudo/onboarding (#176),
  crons Vercel (#191, #194), Memphis (#192), seuils inclusifs (#195), **Lot 1 S1 (#198)** : `pf` (modèle,
  migration prod, backfill, `pf.joblib` sur GCS) + `dreb`/`fgm`/`ftm`/`fta` composés ; Cloud Run redéployé,
  5 stats testées en réel sur le service.
- **Prochaine étape : Lot 1, S4** (condition générique du combo, règle aussi combo période + match entier)
  (`chantiers/CHANTIER_ENRICHISSEMENT_MODELES.md`). Puis S3 + S8, « exactement N »/égalité/score exact,
  S2 en dernier. Avant la bêta Cup du 04/12 ; Lots 2 à 4 ensuite.
- **Pièges Lot 1** : le schéma partagé `structureBet` est AU PLAFOND de grammaire de l'API : pas de nouveau
  champ, élargir un enum (S1 l'a fait sans erreur, 4 vrais appels). Tout changement de schéma = vrais appels
  (test vitest jetable, `usageTracking` mocké avec `recordAnthropicUsage`). Seuils : `inclusiveThreshold.ts`.
  Nouvelle stat comptée = ne pas oublier `statSelectColumns`/`rowStatValue` (combo, duel) et les SELECT.
- **Après 13h Paris, en parallèle** : essai réel 1B. `/api/emails?kind=reminder&only_owner=1&force=1&dry_run=1`
  (Bearer SYNC_SECRET, `.env.local`) ; si `candidates`=1, retirer `dry_run`, vérifier réception, Resend,
  `email_log` ; remettre `email_reminders_enabled=false`. Puis recette 1B.
- **Ouvert** : 983 lignes `stats_box_scores.pf` vides (32 matchs de présaison depuis le 03/10), sans effet
  visible, remplissage bloqué par le classificateur (accord requis) ; « Hauser ou Pritchard » non vérifié ;
  rejouer le pari Memphis `f4f3ebd6…` (coût IA, demander) ; poller VM (dryRun → réel) ; Réel V2 non commité ;
  `stash@{0}`. **Échéances** : figement hebdo 26/10 ; bêta Cup 04/12.
- **Pièges** : une branche + un worktree par PR ; le classificateur bloque merges/reset et écritures prod (`!`).
