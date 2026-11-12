# Reprise — NBA Pronos (12/11/2026, passation 32)
- **PROCHAIN CHANTIER : étape 4 du bilan des probas** = « meilleur marqueur » trop bas (Giannis 39 % vs 49 % réel,
  Doncic 55 % vs 71 %). Piste : Monte-Carlo sur les joueurs qui ont de vraies minutes (pas les blessés), loi réaliste
  pour les remplaçants, calé sur le taux réel de meilleur marqueur sur 2 saisons. Puis 5 paris par période
  (points/écart à la MT, suites de QT), 6 grille de difficulté (palier 5 = toute proba < 25 %, 2 gagnés sur 42).
- **Étape 3 faite (12/11)** : backtest local du modèle de points -> la forêt ne tasse quasiment pas les stars (biais
  ≈ -0,85 pt au-dessus de 25 de moyenne, P(30+/35+/40+) calibrées). Début de saison 2025-26 : stars sous-estimées de
  1 à 3 pts mais joueurs moyens aussi (≈ -1 pt). Aucun correctif du modèle ; **re-mesurer vers fin novembre** sur les
  paris 2026-27 maintenant que la présaison est exclue. Scripts de backtest non versionnés (refaire au besoin).
- **PR #295 (étapes 1+2) mergée et déployée** le 12/11 (révision Cloud Run nba-pronos-stats-00046-vsh, 63 modèles).
  À confirmer sur un vrai pari (ex. « Zion 20+ » doit remonter).
- **En attente** : avatars dans le Chat (`ChatRosterEntry.avatarUrl`, `ChatSubscriber.tsx`, repli de `PlayerIdentity`).
- **À tester à la main** : upload avatar/logo, `/rejoindre` en visiteur. **Sécurité** : politique `tmp_upload_instagram_recaps`
  (upload anonyme) à vérifier/supprimer, voir GAPS_OUVERTS.
- **Bouton admin import box scores** (#284) : jeton `GITHUB_DISPATCH_TOKEN` à poser dans Vercel Prod, redéployer.
- **Quota Vercel Fluid Active CPU** : noter la valeur, décider d'allonger les caches. **Aide débutants** : #274 à merger.
- **Pièges** : fichiers en CRLF ; une branche par PR ; pas d'import pendant le timer VM 12h/16h Paris ; migrations via
  `supabase db push --remote` ; le service stats ne se redéploie pas seul (workflow deploy-stats-service manuel).
  **Hérité** : 983 lignes de présaison dans `stats_box_scores` (= les `pf` vides) ; pari Memphis à rejouer (demander) ;
  poller VM dryRun -> réel ; probas instables. **Échéance** : bêta Cup 04/12.
