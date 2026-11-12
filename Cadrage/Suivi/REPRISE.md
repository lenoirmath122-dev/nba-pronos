# Reprise — NBA Pronos (12/11/2026, passation 31)
- **PROCHAIN CHANTIER : étape 3 du bilan des probas** = vérifier que la forêt aléatoire tasse les stars. Backtest sur le
  début de saison 2026-27 : moyenne prédite vs réelle par tranche de moyenne joueur (pts surtout). Indice : SGA prédit
  26,8 pts au 22/10 alors qu'il tournait à 30,5 ; Luka +35 à 31 % pour 36 pts de moyenne. Si confirmé : calibration
  après coup ou moyenne de saison en feature. Modèles locaux dans `Cadrage/Stats/models/` (63 joblib).
- **Bilan du 12/11** (137 paris persos depuis le 01/10) : calibration globale correcte (Brier 0,149) mais grosses perfs
  des stars sous-estimées, « meilleur marqueur » trop bas (Giannis 39 % vs 49 % réel). Ordre retenu : 1 présaison,
  2 aiguillage, 3 tassement RF, 4 superlatif (Monte-Carlo, bassin réel, loi réaliste), 5 paris par période (points/écart
  à la MT, suites de QT), 6 grille de difficulté (palier 5 = toute proba < 25 %, 2 gagnés sur 42).
- **PR #295 (étapes 1+2)** : présaison/All-Star exclus des lectures `stats_box_scores` du service (`_nba_games_only`),
  « Un joueur met plus de 15 points » -> ROSTER_COUNT. **Après merge : lancer le workflow deploy-stats-service** (manuel).
- **En attente** : avatars dans le Chat (`ChatRosterEntry.avatarUrl`, `ChatSubscriber.tsx`, repli de `PlayerIdentity`).
- **À tester à la main** : upload avatar/logo, `/rejoindre` en visiteur. **Sécurité** : politique `tmp_upload_instagram_recaps`
  (upload anonyme) à vérifier/supprimer, voir GAPS_OUVERTS.
- **Bouton admin import box scores** (#284) : jeton `GITHUB_DISPATCH_TOKEN` à poser dans Vercel Prod, redéployer.
- **Quota Vercel Fluid Active CPU** : noter la valeur, décider d'allonger les caches. **Aide débutants** : #274 à merger.
- **Pièges** : fichiers en CRLF ; une branche par PR ; pas d'import pendant le timer VM 12h/16h Paris ; migrations via
  `supabase db push --remote`. **Hérité** : 983 lignes de présaison dans `stats_box_scores` (= les `pf` vides) ; pari
  Memphis à rejouer (demander) ; poller VM dryRun -> réel ; probas instables. **Échéance** : bêta Cup 04/12.
