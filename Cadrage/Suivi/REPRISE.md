# Reprise — NBA Pronos (24/10/2026, passation 16)
- **Chantier en cours : Profil & badges** (`chantiers/CHANTIER_PROFIL_BADGES.md`). Livraison groupée **lundi 26/10** via
  `release/profil-badges` : chaque lot = branche depuis `release/profil-badges`, PR vers elle, jamais vers `main`.
  Fichiers de suivi : PR doc vers `main`. Les docs du chantier ne sont PAS dans release (les lire depuis `main`).
- **Lot 1 FAIT et mergé** (#236) : `resolveShowcase`, `getShowcaseBadges` (lecture groupée). Pas de migration `badges_seen` :
  l'état « vu » est déjà en base via `user_seen_state` (#230). **D7** (date de déblocage des paliers) à trancher : colonne
  dédiée ou clé dans `user_seen_state`, avant le Lot 4 où elle sert.
- **Lot 2 : PR #237 ouverte**, pas mergée. Aperçu : https://nba-pronos-git-feat-pb-lot-2-lenoir-nba.vercel.app (derrière le
  SSO Vercel, base de PROD). Recette à faire : `/players/[id]` d'un joueur avec badges épinglés, taper un écusson (375 px,
  desktop, clair/sombre). `PlayerIdentity` pas encore branché (classement = Lot 5, en-tête = Lot 3).
- **Ensuite** : Lot 4 (onglet Badges), 5 (classement), 3 (Mon profil). **Pièges du chantier** : aucune nouvelle couleur (DA) ; avatar jamais teinté équipe ; connexion sur `*.vercel.app`
  (Turnstile, redirections Supabase) non vérifiée ; worktree = junction `node_modules` vers le dépôt principal.
- **État lu/vu lié au compte (PR #230)** : si mergée, **`supabase db push`** (`20261023090000`, `20261023100000`) puis
  `supabase migration list`.
- **Enrichissement Lot 2** : S6 « N quarts », L8 alias ; `chantiers/CHANTIER_ENRICHISSEMENT_MODELES.md`.
- **Pièges généraux** : `structureBet` AU PLAFOND de grammaire ; changement de schéma/prompt = vrais appels (vitest
  jetable, `usageTracking` mocké) ; une branche + un worktree par PR ; le classificateur bloque merges/reset/écritures prod.
- **Ouvert** : 983 lignes `stats_box_scores.pf` vides ; « Hauser ou Pritchard » ; rejouer pari Memphis `f4f3ebd6…` (coût IA,
  demander) ; poller VM (dryRun → réel) ; instabilité des probas ; `stash@{0}`.
  **Échéances** : figement hebdo + livraison Profil & badges 26/10 ; bêta Cup 04/12.
