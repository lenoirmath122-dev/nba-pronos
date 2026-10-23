# Reprise — NBA Pronos (23/10/2026, passation 14)
- **Livré** : Lot 1 CLOS (#198-#206), popup « Depuis ta dernière visite » (#210), /play « Mon pari » (#216), chat menu +
  réactions (#221, non testées à 2 comptes) + Copier (#223), écart orienté sur une période (#227).
- **Session 14** : état lu/vu lié au compte (**PR #230**, l'utilisateur la merge et teste Chrome → Firefox/privé).
  **Après merge : `supabase db push`** (`20261023090000` chat_read_status, `20261023100000` user_seen_state), puis
  `supabase migration list`. Laissés en local exprès : PushPrompt, OnboardingGuide, panier invité.
- **D'abord à la prochaine session : trier 7 changements non commités** (tous `??`), un lot par sujet, branche + PR :
  `Cadrage/Business/panier_ballon_instagram_octobre_novembre.md` + `panier_ballon_x_lancement_octobre.md` ;
  `Cadrage/docs/` (pack Réel V2 : PNG, plan, mp3, lourd, décider quoi versionner) ; `Cadrage/Feuille de route 09 sept.html`
  + `_files/` (export, probablement à ignorer) ; `scripts/stats-service-smoke.py` (relire avant) ;
  `.claude/.headroom_wrap_settings.lock` (verrou local : `.gitignore`, ne pas commiter).
- **Puis Lot 2** : S6 « joue seulement N quarts » (un quart non joué = ligne à 0 ou absente de
  `stats_box_scores_by_period` ?), L8 alias de noms ; voir `chantiers/CHANTIER_ENRICHISSEMENT_MODELES.md`.
- **Pièges** : `structureBet` AU PLAFOND de grammaire (élargir un enum, pas de champ) ; changement de schéma/prompt =
  vrais appels (vitest jetable, `usageTracking` mocké) ; une branche + un worktree par PR ; le classificateur bloque
  merges/reset/écritures prod (`!`). Essai réel 1B : `/api/emails?kind=reminder&only_owner=1&force=1&dry_run=1`.
- **Ouvert** : 983 lignes `stats_box_scores.pf` vides ; « Hauser ou Pritchard » ; rejouer pari Memphis `f4f3ebd6…`
  (coût IA, demander) ; poller VM (dryRun → réel) ; instabilité des probas ; `stash@{0}`.
  **Échéances** : figement hebdo 26/10 ; bêta Cup 04/12.
