# Reprise — NBA Pronos (18/11/2026, passation 41)
- **Chantier mode invité** (`Cadrage/Suivi/chantiers/CHANTIER_MODE_INVITE.md`) : lots A à G CODÉS sur la branche locale
  `feat/mode-invite` (rien de poussé, branchée sur `docs/passation-33`). Une seule branche + PR globale.
  **Premier pas** : dérouler la checklist de recette (bas du chantier) en local/preview, puis pousser la branche et ouvrir la PR.
- **Au moment de pousser** : (1) vérifier `/leaderboard`, `/players`, `/match/[id]`, `/chat` en invité ; (2) `supabase db push --remote`
  (2 migrations : `20261118090000` grant `anon` par colonne, `20261118120000` événements invité) ; chercher toute lecture de `users`
  en anon hors colonnes accordées ; (3) renommer le compte à pseudo e-mail (id `5b39327a…`) ; (4) aucun test navigateur fait sur les pages invité.
- **Build local** : échoue sur `Cadrage/docs/reel-v2-pack` (gitignoré, remotion absent) ; le déplacer le temps du build.
- **Probas** : #295 déployé, à confirmer sur un vrai pari. **Fin novembre** : mesurer les paliers 66/53/35/20 % (paris après le 12/11).
- **Autres chantiers en attente** : avatars dans le Chat (`ChatRosterEntry.avatarUrl`) ; préparation bêta Cup (04/12).
- **À tester à la main** : upload avatar/logo, `/rejoindre` en visiteur. **Sécurité** : politique `tmp_upload_instagram_recaps`
  (upload anonyme) à vérifier/supprimer, voir GAPS_OUVERTS.
- **Bouton admin import box scores** (#284) : jeton `GITHUB_DISPATCH_TOKEN` à poser dans Vercel Prod. **Aide débutants** : #274 à merger.
- **VM nba-refresh (18/11)** : panne = noyau Debian `6.1.0-55` (panic ext4), pas le disque. Revenue au `6.1.0-54`, méta-paquet
  `linux-image-cloud-amd64` purgé (plus de noyau auto, à remettre quand un noyau corrigé sort). Voir GAPS_OUVERTS.
- **Pièges** : fichiers en CRLF (éditer via script Python en UTF-8) ; pas d'import pendant le timer VM 12h/16h Paris ; migrations via
  `supabase db push --remote` ; le service stats ne se redéploie pas seul. **Hérité** : 983 lignes de présaison dans
  `stats_box_scores` ; pari Memphis à rejouer (demander) ; poller VM dryRun -> réel. **Échéance** : bêta Cup 04/12.
- **Repris de main (13-18/11)** : PR #299 Actualité (migration `20261113150000_recap_reactions` à pousser AVANT déploiement), PR #298 feuilles de match (BOX_SCORES_PUBLISH), PR #296 paliers 66/53/35/20, PR #303/#304 incident VM 18/11 + garde « match sans score ». GCP Free Trial expire 20/11.
