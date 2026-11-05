# Reprise — NBA Pronos (05/11/2026, passation 25)
- **Chantier quota Vercel « Fluid Active CPU »** (alerte 90 % le 05/11) : #276, #277, #278 (cache des lectures COMMUNES) et
  #279 (`prefetch={false}` sur PlayerLink, annuaire, liens légaux) **tous mergés le 05/11**. Rien d'ouvert sur ce chantier.
- **Cache (#278)** : `lib/cache/commonData.ts` (unstable_cache, client anon, tags `common-*`, repli sur le client de la requête).
  Cachés : compétition (10 min), séries DAILY (5 min), matchs à venir (5 min), scores live (1 min), `user_scores` (1 h,
  invalidé aussi à l'activation et à la suppression de compte). Invalidation `expire: 0` depuis `api/sync/*`, `daily-match/draw`,
  `snapshots/leaderboard`, `recompute*`, `resolveAllCalculableBets`, `logAdminAction`.
- **Non caché (signalé dans la PR)** : `count_committed_predictions`, pronos des autres, bets du classement, résultats terminés,
  séries du bracket, classement hebdo, ligues, tout le personnel.
- **Vérifié** : `user_scores` lisible par la clé anon (HTTP 200, 05/11). **Reste à constater** : après un recalcul, le
  classement bouge sans attendre le TTL de 1 h (sinon regarder l'invalidation).
- **Ensuite** : noter « Fluid Active CPU » (page Usage) avant/après merge ; décider d'allonger les durées ou de cacher résultats
  terminés + séries du bracket. Mesure par route impossible sur Hobby.
- **Aide aux débutants** : #274 (bouton « Détail des équipes » compact) à merger ; captures du réel (Docker + Supabase
  local : **demander avant**) ; voir `chantiers/CHANTIER_AIDE_DEBUTANTS.md`.
- **Pièges** : fichiers en CRLF ; heredoc bash avec apostrophes échoue (Write) ; `tsc`/`eslint` : erreurs connues dans
  `Cadrage/docs/reel*` et `.next/dev/types` ; une branche par PR ; le classificateur bloque merges / écritures prod.
- **Ouvert, hérité** : 983 `stats_box_scores.pf` vides ; pari Memphis `f4f3ebd6…` à rejouer (coût IA, demander) ; poller VM
  (dryRun → réel) ; probas instables. **Échéances** : bêta Cup 04/12.
