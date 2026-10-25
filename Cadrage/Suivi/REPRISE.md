# Reprise — NBA Pronos (25/10/2026, passation 19)
- **Chantier en cours : Profil & badges** (`chantiers/CHANTIER_PROFIL_BADGES.md`). Livraison groupée **lundi 26/10** via
  `release/profil-badges` : chaque lot = branche depuis la release, PR vers elle, jamais vers `main`.
  Fichiers de suivi : PR doc vers `main` (les docs du chantier ne sont PAS dans release).
- **Mergés dans release** : Q (#234), 1 (#236), 2 (#237), 4 (#239), 5 (#241), 3a (#243), 3b (#244).
- **PR #245 ouverte vers release** (`fix/pb-epingle-vitrine`) : 4 commits poussés sur `feat/pb-lot-5` APRÈS le merge de
  #241 n'étaient pas dans la release (épingle directe sur chaque carte, vitrine = épinglés seulement donc plus de badges
  non choisis dans le classement, popover en feuille mobile). Aperçu :
  https://nba-pronos-git-fix-pb-epingle-vitrine-lenoir-nba.vercel.app (SSO Vercel, base de PROD). **À merger puis recetter**
  (épingle visible sur Mon profil et profil des autres ; classement sans badge si rien d'épinglé). Pas de recette visuelle faite par Claude.
- **Leçon** : après un merge de PR, vérifier que les commits poussés ensuite sur la branche y sont (`git log release..branche`).
- **Ensuite** : Lot 6 (optionnel), Lot 7 visuels badges (indépendant), Lot 8 animations (après 26/10, repasser par Claude
  desktop). D7 (date de déblocage) à trancher. Ce qui n'est pas recetté dimanche soir attend le 02/11.
  Puis merge de `release/profil-badges` vers `main` le 26/10.
- **Pièges du chantier** : aperçu derrière le SSO et sur la base de PROD ; aucune nouvelle couleur (DA) ; connexion sur
  `*.vercel.app` (Turnstile) non vérifiée ; worktree = junction `node_modules` vers un autre worktree.
- **Enrichissement Lot 2** (S6, L8). **Pièges généraux** : `structureBet` AU PLAFOND de grammaire ; une branche + un
  worktree par PR ; le classificateur bloque merges/reset/écritures prod.
- **Ouvert** : 983 `stats_box_scores.pf` vides ; « Hauser ou Pritchard » ; pari Memphis `f4f3ebd6…` (coût IA) ;
  poller VM (dryRun → réel) ; probas instables ; `stash@{0}`. **Échéances** : figement hebdo + livraison 26/10 ; bêta Cup 04/12.
