# Reprise — NBA Pronos (23/10/2026, passation 14)
- **Livré** : accueil jouable + invités, e-mails 1B, crons Vercel, Memphis, seuils inclusifs, **Lot 1 CLOS**
  (#198-#206). Sessions 9-12 : popup « Depuis ta dernière visite » (#210), profil (#212), accueil « Prochain prono »
  (PR ouverte, recette à faire), /play « Mon pari » (#216), chat : menu, réactions (#221, non testées à 2 comptes), Copier (#223).
- **Session 14** : état « lu / vu » lié au compte, plus au navigateur (**PR #230**, à merger par l'utilisateur, qui
  teste lui-même Chrome → Firefox/privé). **Après merge : `supabase db push`** (2 migrations `20261023090000` chat_read_status
  + `20261023100000` user_seen_state) puis `supabase migration list`. Laissés en local exprès : PushPrompt, OnboardingGuide, panier invité.
- **Session suivante, d'abord : trier les 7 changements non commités** (tous `??`, jamais suivis par git), un lot par sujet,
  branche + PR chacun : `Cadrage/Business/panier_ballon_instagram_octobre_novembre.md` + `panier_ballon_x_lancement_octobre.md`
  (docs business) ; `Cadrage/docs/` (pack Réel V2 : PNG, plan, mp3 — lourd, décider quoi versionner) ; `Cadrage/Feuille de route
  09 sept.html` + `_files/` (export probablement à ignorer) ; `scripts/stats-service-smoke.py` (script smoke, relire avant) ;
  `.claude/.headroom_wrap_settings.lock` (verrou local : ajouter au `.gitignore`, ne pas commiter).
- **Ensuite** : **écart orienté sur une période** (« Les Jazz se prennent 10 pts à la mi-temps »,
  pari `62bd0e71…`, match 24/10 01:30 UTC). `MARGIN` (`lib/ai/structurePeriodBet.ts`) est symétrique seulement : ajouter
  équipe + sens (mène/perd), résolution dans `resolvePeriodBets.ts`, proba (vérifier ce que le modèle d'écart de période
  expose). Branche à part. Résoudre ce pari à la main après le match.
- **Puis Lot 2** : S6 « joue seulement N quarts » (un quart non joué = ligne à 0 ou aucune dans
  `stats_box_scores_by_period` ?), L8 alias de noms ; voir `chantiers/CHANTIER_ENRICHISSEMENT_MODELES.md`.
- **Hors-terrain** = manuel normal ; Rillettes-31 = compétitions archivées. **Pièges** : `structureBet` AU PLAFOND de grammaire (élargir un enum, pas de champ). Changement de schéma/prompt =
  vrais appels (vitest jetable, `usageTracking` mocké). Nouvelle stat = `statSelectColumns`/`rowStatValue` + SELECT.
  Une branche + un worktree par PR. Le classificateur bloque merges/reset/écritures prod (`!`).
- **Essai réel 1B** : `/api/emails?kind=reminder&only_owner=1&force=1&dry_run=1` (Bearer SYNC_SECRET) ; si
  `candidates`=1 retirer `dry_run`, vérifier Resend/`email_log`, remettre `email_reminders_enabled=false`.
- **Ouvert** : 983 lignes `stats_box_scores.pf` vides ; « Hauser ou Pritchard » ; rejouer pari Memphis `f4f3ebd6…`
  (coût IA, demander) ; poller VM (dryRun → réel) ; instabilité des probas ; Réel V2 non commité ; `stash@{0}`.
  **Échéances** : figement hebdo 26/10 ; bêta Cup 04/12.
