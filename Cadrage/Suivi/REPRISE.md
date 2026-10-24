# Reprise — NBA Pronos (24/10/2026, passation 18)
- **Chantier en cours : Profil & badges** (`chantiers/CHANTIER_PROFIL_BADGES.md`). Livraison groupée **lundi 26/10** via
  `release/profil-badges` : chaque lot = branche depuis `release/profil-badges`, PR vers elle, jamais vers `main`.
  Fichiers de suivi : PR doc vers `main` (les docs du chantier ne sont PAS dans release).
- **Faits et mergés** : Q (#234), 1 (#236), 2 (#237), 4 (#239). **Lot 5 FAIT : PR #241 ouverte vers release**, CI verte,
  aperçu : https://nba-pronos-git-feat-pb-lot-5-lenoir-nba.vercel.app (derrière SSO Vercel). **Recette visuelle pas faite** :
  375 px portrait/paysage, 24 joueurs, ligues, tri, barre « Ta place » (> 20 joueurs), temps de chargement avant/après
  à noter dans la PR. L'utilisateur la merge dans release.
- **Lot 5, choix** : `getRowShowcases` (1 salve, sans chunking : à surveiller au-delà de quelques centaines de joueurs) ;
  3 écussons rendus, 2 masqués en CSS en portrait < 768 px, 1 dans `StickyMeBar` (lien étiré, plus de bouton dans un lien) ;
  bandeau champion hebdo laissé en texte ; visiteur non connecté : badges absents si la RLS les bloque (non vérifié).
- **Ensuite** : Lot 3 (Mon profil, 2 PR si besoin ; redirection de `togglePinnedBadgeFormAction` à revoir), puis 6.
  D7 (date de déblocage) toujours à trancher. Ce qui n'est pas recetté dimanche soir attend le 02/11.
- **Pièges du chantier** : aperçu Vercel derrière le SSO et sur la base de PROD ; aucune nouvelle couleur (DA) ; connexion
  sur `*.vercel.app` (Turnstile) non vérifiée ; worktree = junction `node_modules` vers un autre worktree.
- **PR #230 (état lu/vu)** : si mergée, **`supabase db push`** (`20261023090000`, `20261023100000`) puis `migration list`.
- **Enrichissement Lot 2** (S6, L8 : `chantiers/CHANTIER_ENRICHISSEMENT_MODELES.md`). **Pièges généraux** : `structureBet` AU PLAFOND de grammaire ; schéma/prompt = vrais appels ; une branche + un worktree
  par PR ; le classificateur bloque merges/reset/écritures prod.
- **Ouvert** : 983 `stats_box_scores.pf` vides ; « Hauser ou Pritchard » ; pari Memphis `f4f3ebd6…` (coût IA, demander) ;
  poller VM (dryRun → réel) ; probas instables ; `stash@{0}`. **Échéances** : figement hebdo + livraison 26/10 ; bêta Cup 04/12.
