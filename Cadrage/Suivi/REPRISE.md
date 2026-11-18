# Reprise — NBA Pronos (18/11/2026, passation 37)
- **Chantier mode invité** (`Cadrage/Suivi/chantiers/CHANTIER_MODE_INVITE.md`) : lots A, B, D, C CODÉS sur la branche locale
  `feat/mode-invite` (5 commits, rien de poussé, branchée sur `docs/passation-33`). Une seule branche + PR globale.
  B = `AuthGateProvider`/modale/action en attente/brouillon chat ; D = OG match + `/ce-soir` ; C = consigne hors webview.
  **Premier pas** : lot E (bandeau invité), puis F (mesure + migration `funnel_events`), G (perf mobile + recette).
- **Au moment de pousser** : (1) vérifier `/leaderboard`, `/players`, `/match/[id]`, `/chat` en invité ; (2) `supabase db push --remote`
  (migration `20261118090000`, grant `anon` par colonne, chercher toute lecture de `users` en anon hors colonnes accordées) ;
  (3) renommer le compte à pseudo e-mail (id `5b39327a…`) ; (4) pas de test navigateur fait sur les pages du lot A.
- **Probas** : #295 déployé, à confirmer sur un vrai pari. **Fin novembre** : mesurer les paliers 66/53/35/20 % (paris après le 12/11).
- **Autres chantiers en attente** : avatars dans le Chat (`ChatRosterEntry.avatarUrl`) ; préparation bêta Cup (04/12).
- **À tester à la main** : upload avatar/logo, `/rejoindre` en visiteur. **Sécurité** : politique `tmp_upload_instagram_recaps`
  (upload anonyme) à vérifier/supprimer, voir GAPS_OUVERTS.
- **Bouton admin import box scores** (#284) : jeton `GITHUB_DISPATCH_TOKEN` à poser dans Vercel Prod. **Aide débutants** : #274 à merger.
- **Pièges** : fichiers en CRLF (éditer via script Python en UTF-8) ; pas d'import pendant le timer VM 12h/16h Paris ; migrations via
  `supabase db push --remote` ; le service stats ne se redéploie pas seul. **Hérité** : 983 lignes de présaison dans
  `stats_box_scores` ; pari Memphis à rejouer (demander) ; poller VM dryRun -> réel. **Échéance** : bêta Cup 04/12.
