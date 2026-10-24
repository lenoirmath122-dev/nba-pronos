# Reprise — NBA Pronos (24/10/2026, passation 17)
- **Chantier en cours : Profil & badges** (`chantiers/CHANTIER_PROFIL_BADGES.md`). Livraison groupée **lundi 26/10** via
  `release/profil-badges` : chaque lot = branche depuis `release/profil-badges`, PR vers elle, jamais vers `main`.
  Fichiers de suivi : PR doc vers `main` (les docs du chantier ne sont PAS dans release).
- **Faits et mergés** : Q (#234), 1 (#236, pas de colonne `badges_seen` : `user_seen_state` suffit), 2 (#237,
  `PlayerIdentity` pas encore branché), **4 (#239, onglet Badges, recette OK, épingle directe sur chaque carte)**.
- **Lot 4, écarts au plan** : un seul composant client `BadgesTab` ; pas de bouton « Modifier » ; toujours sur
  `/stats?tab=badges` (déplacé par le Lot 3, dont la redirection de `togglePinnedBadgeFormAction` est à revoir) ; prop
  `readOnly` prête pour `/players/[id]`. **D7** (date de déblocage) toujours à trancher, aucun lot ne l'utilise.
- **Ensuite** : Lot 5 (classement : `PlayerIdentity` + `getShowcaseBadges`), puis 3 (Mon profil, 2 PR si besoin). Ce qui
  n'est pas recetté dimanche soir attend le 02/11.
- **Pièges du chantier** : aperçu Vercel derrière le SSO et sur la base de PROD ; aucune nouvelle couleur (DA) ; connexion
  sur `*.vercel.app` (Turnstile) non vérifiée ; worktree = junction `node_modules` vers un autre worktree.
- **PR #230 (état lu/vu)** : si mergée, **`supabase db push`** (`20261023090000`, `20261023100000`) puis `migration list`.
- **Enrichissement Lot 2** : S6 « N quarts », L8 alias ; `chantiers/CHANTIER_ENRICHISSEMENT_MODELES.md`.
- **Pièges généraux** : `structureBet` AU PLAFOND de grammaire ; schéma/prompt = vrais appels ; une branche + un worktree
  par PR ; le classificateur bloque merges/reset/écritures prod.
- **Ouvert** : 983 `stats_box_scores.pf` vides ; « Hauser ou Pritchard » ; pari Memphis `f4f3ebd6…` (coût IA, demander) ;
  poller VM (dryRun → réel) ; probas instables ; `stash@{0}`. **Échéances** : figement hebdo + livraison 26/10 ; bêta Cup 04/12.
