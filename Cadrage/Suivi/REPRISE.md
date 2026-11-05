# Reprise — NBA Pronos (05/11/2026, passation 24)
- **Chantier quota Vercel « Fluid Active CPU »** (alerte 90 % le 05/11) : #276 (proxy sans Supabase pour les anonymes) et
  #277 (thème en cookie, accueil pré-rendu) mergés. **PR ouvertes** : #278 `perf/cache-donnees-communes` (cache serveur des
  lectures COMMUNES) et #279 `perf/desactiver-prefetch-liens` (`prefetch={false}` sur PlayerLink, annuaire, liens légaux).
- **#278** : `lib/cache/commonData.ts` (unstable_cache, client anon, tags `common-*`, repli sur le client de la requête).
  Cachés : compétition (10 min), séries DAILY (5 min), matchs à venir (5 min), scores live (1 min), `user_scores` (1 h,
  invalidé aussi à l'activation et à la suppression de compte). Invalidation `expire: 0` depuis `api/sync/*`, `daily-match/draw`,
  `snapshots/leaderboard`, `recompute*`, `resolveAllCalculableBets`, `logAdminAction`.
- **Non caché (signalé dans la PR)** : `count_committed_predictions`, pronos des autres, bets du classement, résultats terminés,
  séries du bracket, classement hebdo, ligues, tout le personnel.
- **À vérifier sur le preview** : `user_scores` lisible par la clé anon (sinon repli silencieux) ; un score synchronisé
  apparaît sans attendre le TTL.
- **Ensuite** : noter « Fluid Active CPU » (page Usage) avant/après merge ; décider d'allonger les durées ou de cacher résultats
  terminés + séries du bracket. Mesure par route impossible sur Hobby.
- **Aide aux débutants** : #274 (bouton « Détail des équipes » compact) à merger ; captures du réel (Docker + Supabase
  local : **demander avant**) ; voir `chantiers/CHANTIER_AIDE_DEBUTANTS.md`.
- **Pièges** : fichiers en CRLF ; heredoc bash avec apostrophes échoue (Write) ; `tsc`/`eslint` : erreurs connues dans
  `Cadrage/docs/reel*` et `.next/dev/types` ; une branche par PR ; le classificateur bloque merges / écritures prod.
- **Ouvert, hérité** : 983 `stats_box_scores.pf` vides ; pari Memphis `f4f3ebd6…` à rejouer (coût IA, demander) ; poller VM
  (dryRun → réel) ; probas instables. **Échéances** : bêta Cup 04/12.
