# Reprise — NBA Pronos (23/10/2026, passation 15)
- **Chantier en cours : Profil & badges** (`chantiers/CHANTIER_PROFIL_BADGES.md`, plan #233 mergé). Livraison groupée
  **lundi 26/10** via `release/profil-badges` (§4 bis) : chaque lot = branche depuis `release/profil-badges`, PR vers
  `release/profil-badges`, jamais vers `main`. Fichiers de suivi : PR doc vers `main`.
- **Lot Q FAIT** : PR #234 vers release, recette OK (375 px, Général, panneau). **L'utilisateur la merge** dans release.
  Prochain : Lot 1 (vitrine `resolveShowcase` + `getShowcaseBadges`, migration additive `users.badges_seen`), puis 2, 4, 5, 3.
- **Pièges du chantier** : l'aperçu Vercel est derrière le SSO Vercel et partage la base de PROD ; migration additive
  préparée seulement, c'est l'utilisateur qui l'applique (avant de tester le Lot 1) ; aucune nouvelle couleur (DA).
  Connexion sur `*.vercel.app` (Turnstile, redirections Supabase) : non vérifiée par Claude, à confirmer.
- **Livré avant** : Lot 1 enrichissement CLOS (#198-#206), popup « Depuis ta dernière visite » (#210), /play « Mon pari »
  (#216), chat menu + réactions (#221, non testées à 2 comptes) + Copier (#223), écart orienté période (#227), tri des
  fichiers non suivis (#232).
- **État lu/vu lié au compte (PR #230)** : si mergée, **`supabase db push`** (`20261023090000` chat_read_status,
  `20261023100000` user_seen_state) puis `supabase migration list`.
- **Ensuite Lot 2 enrichissement** : S6 « joue seulement N quarts » (quart non joué = ligne à 0 ou absente de
  `stats_box_scores_by_period` ?), L8 alias de noms ; `chantiers/CHANTIER_ENRICHISSEMENT_MODELES.md`.
- **Pièges généraux** : `structureBet` AU PLAFOND de grammaire ; changement de schéma/prompt = vrais appels (vitest
  jetable, `usageTracking` mocké) ; une branche + un worktree par PR ; le classificateur bloque merges/reset/écritures prod.
- **Ouvert** : 983 lignes `stats_box_scores.pf` vides ; « Hauser ou Pritchard » ; rejouer pari Memphis `f4f3ebd6…`
  (coût IA, demander) ; poller VM (dryRun → réel) ; instabilité des probas ; `stash@{0}`.
  **Échéances** : figement hebdo + livraison Profil & badges 26/10 ; bêta Cup 04/12.
