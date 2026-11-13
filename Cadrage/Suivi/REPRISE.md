# Reprise — NBA Pronos (13/11/2026, passation 34)
- **Feuilles de match statiques (PR à merger, branche `feat/feuilles-de-match`)** : la VM publie un JSON par match
  terminé (box score seul) dans le bucket public `box-scores`, 2 à 5 min après le buzzer (poller), réécrit le
  lendemain (refresh_job) ; bouton « Feuille de match » sur les cartes Résultats, lu sur le CDN Supabase (0 CPU
  Vercel). **Mise en service** (DEPLOIEMENT_VM.md, « Feuilles de match ») : `supabase db push --remote`, puis
  `BOX_SCORES_PUBLISH=dry` un soir (capture de test synthétique : ce soir-là valide le format réel), puis `=1`,
  puis rattrapage `box_scores.py --backfill --since 2026-10-21`. Désactivé par défaut tant que la ligne manque.
- **PR #296 à merger** : paliers de difficulté 66/53/**35/20 %**. **Fin novembre** : revoir le palier 2 (gagné
  ~80 % pour ~59 % annoncé) et re-mesurer les probas des stars (présaison exclue depuis #295).
- **PROCHAIN CHANTIER : étape 5** des probas = paris par période (points/écart à la MT, suites de QT).
- **#295 déployé** (Cloud Run nba-pronos-stats-00046-vsh) : à confirmer sur un vrai pari (« Zion 20+ » doit remonter).
- **En attente** : avatars dans le Chat (`ChatRosterEntry.avatarUrl`, `ChatSubscriber.tsx`, repli de `PlayerIdentity`).
- **À tester à la main** : upload avatar/logo, `/rejoindre` en visiteur. **Sécurité** : politique `tmp_upload_instagram_recaps`
  (upload anonyme) à vérifier/supprimer, voir GAPS_OUVERTS.
- **Bouton admin import box scores** (#284) : jeton `GITHUB_DISPATCH_TOKEN` à poser dans Vercel Prod, redéployer.
- **Quota Vercel Fluid Active CPU** : noter la valeur, décider d'allonger les caches. **Aide débutants** : #274 à merger.
- **Pièges** : fichiers en CRLF ; une branche par PR ; pas d'import pendant le timer VM 12h/16h Paris ; migrations via
  `supabase db push --remote` ; le service stats ne se redéploie pas seul ; le poller VM ne fait pas de `git pull`
  (code mis à jour aux passages 12h/16h). **Hérité** : 983 lignes de présaison dans `stats_box_scores` ; pari Memphis
  à rejouer (demander). **Échéances** : crédit GCP Free Trial expire le 20/11 ; bêta Cup 04/12.
