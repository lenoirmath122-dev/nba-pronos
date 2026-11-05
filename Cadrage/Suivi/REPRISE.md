# Reprise — NBA Pronos (05/11/2026, passation 24)
- **Chantier quota Vercel « Fluid Active CPU »** (alerte 90 % le 05/11) : #276 (proxy sans Supabase pour les anonymes) et
  #277 (thème en cookie) mergés. **PR ouverte : `perf/cache-donnees-communes`** (cache serveur des lectures COMMUNES).
- **Fait** : `lib/cache/commonData.ts` (unstable_cache, client anon, tags `common-*`, repli sur le client de la requête).
  Cachés : compétition active (10 min), séries DAILY (5 min), matchs à venir (5 min, coupe à l'instant exact en mémoire),
  scores live (1 min), `user_scores` du classement général (1 h, invalidé aussi à l activation et à la suppression de compte). Invalidation `expire: 0` depuis `api/sync/*`,
  `daily-match/draw`, `snapshots/leaderboard`, `recompute*`, `resolveAllCalculableBets`, `logAdminAction` (toute action admin).
- **Non caché, signalé dans la PR** : `count_committed_predictions`, pronos des autres après coup d'envoi, bets du
  classement, résultats terminés (/play/results), séries du bracket, classement hebdo, ligues, tout le personnel.
- **À vérifier sur le preview** : `user_scores` lisible par la clé anon (sinon repli silencieux, donc aucun gain mais aucun
  bug) ; un score synchronisé apparaît sans attendre le TTL ; un nouveau joueur apparaît au classement au plus 5 min plus tard.
- **Ensuite** : MESURE à faire (le MCP Vercel renvoie 400 sans détail sur observability/query ; CLI `vercel metrics` ou tableau de bord Observability) avant/après merge pour décider d'allonger les durées
  (règle : court d'abord, puis allonger) et de cacher résultats terminés + séries du bracket.
- **Aide aux débutants** : #274 (bouton « Détail des équipes » compact) à merger ; captures du réel (Docker + Supabase
  local : **demander avant**) ; L1-4, L1-5, L5 voir `chantiers/CHANTIER_AIDE_DEBUTANTS.md`.
- **Pièges** : fichiers en CRLF (scripts d'édition : normaliser) ; heredoc bash avec apostrophes échoue (utiliser Write) ;
  `tsc`/`eslint` signalent des erreurs connues dans `Cadrage/docs/reel*` et `.next/dev/types` ; une branche par PR ;
  le classificateur bloque merges / écritures prod ; tests d'intégration (Docker) non lancés.
- **Ouvert, hérité** : 983 `stats_box_scores.pf` vides ; pari Memphis `f4f3ebd6…` à rejouer (coût IA, demander) ; poller VM
  (dryRun → réel) ; probas instables. **Échéances** : bêta Cup 04/12.
