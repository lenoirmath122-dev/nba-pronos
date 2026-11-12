# Reprise — NBA Pronos (12/11/2026, passation 33)
- **PR #296 à merger** : paliers de difficulté 66/53/**35/20 %** (points 5-25 inchangés, 39 % -> 15 pts). Vercel
  seul, nouveaux paris seulement. Simulé sur la saison : -5 % de points. **Fin novembre** : revoir le palier 2
  (gagné ~80 % pour ~59 % annoncé) et re-mesurer les probas des stars (présaison exclue depuis #295).
- **Étape 4 (meilleur marqueur) close sans code** : la formule est calibrée, l'adversaire est pris en compte ;
  l'écart vient des moyennes du modèle. Voir GAPS_OUVERTS (0 % Isaiah Joe à expliquer, pistes laissées de côté).
- **PROCHAIN CHANTIER : étape 5** = paris par période (points/écart à la MT, suites de QT). L'étape 6
  (grille de difficulté) est en partie faite via #296.
- **#295 déployé** (Cloud Run nba-pronos-stats-00046-vsh) : à confirmer sur un vrai pari (« Zion 20+ » doit remonter).
- **En attente** : avatars dans le Chat (`ChatRosterEntry.avatarUrl`, `ChatSubscriber.tsx`, repli de `PlayerIdentity`).
- **À tester à la main** : upload avatar/logo, `/rejoindre` en visiteur. **Sécurité** : politique `tmp_upload_instagram_recaps`
  (upload anonyme) à vérifier/supprimer, voir GAPS_OUVERTS.
- **Bouton admin import box scores** (#284) : jeton `GITHUB_DISPATCH_TOKEN` à poser dans Vercel Prod, redéployer.
- **Quota Vercel Fluid Active CPU** : noter la valeur, décider d'allonger les caches. **Aide débutants** : #274 à merger.
- **Pièges** : fichiers en CRLF ; une branche par PR ; pas d'import pendant le timer VM 12h/16h Paris ; migrations via
  `supabase db push --remote` ; le service stats ne se redéploie pas seul (workflow deploy-stats-service manuel).
  Backtests locaux : `Cadrage/Stats/data/nba.db` (scripts non versionnés). **Hérité** : 983 lignes de présaison dans
  `stats_box_scores` ; pari Memphis à rejouer (demander) ; poller VM dryRun -> réel. **Échéance** : bêta Cup 04/12.
