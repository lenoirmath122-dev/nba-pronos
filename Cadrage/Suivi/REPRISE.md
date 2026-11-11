# Reprise — NBA Pronos (11/11/2026, passation 29)
- **PR unique « Chat / reprise auto / Classement / Profil »** (branche `feat/chat-creer-ligue`) : carte « Créer une ligue »
  + `/rejoindre/[code]` ; reprise auto après inscription (cookie `pb_join`, `lib/auth/pendingLeague.ts`, consommé à la
  connexion, à l'inscription avec session et au retour du lien magique/Google ; limites : e-mail confirmé sur un autre
  appareil, 1er compte Google) ; Classement rouvre la dernière ligue vue (cookie `pb_lb_scope`) ; Profil : roue crantée
  -> `/profile/modifier` (photo, pseudo, équipe, bio), logo de ligue importable par le créateur ; avatars au classement
  (photo > logo d'équipe sur fond blanc > initiales), bulle cliquable vers le profil.
- **Migration `20261111090000_avatars_league_logos.sql`** (buckets `avatars`/`league-logos`, `leagues.logo_url`) : à
  vérifier avec `supabase migration list` ; le code lit `logo_url`, donc la migration doit être déployée AVEC la PR.
- **Pas de limite** au nombre de ligues créables (décidé 11/11).
- **À faire** : avatars dans le Chat (pas encore) ; logo de ligue réservé au créateur (à confirmer) ; tester à la main
  upload avatar/logo et le parcours `/rejoindre` en visiteur.
- **Bouton admin import box scores** (PR #284) : jeton GitHub `GITHUB_DISPATCH_TOKEN` dans Vercel Prod à poser par
  l'utilisateur, redéployer, tester.
- **Quota Vercel Fluid Active CPU** : noter la valeur, décider d'allonger les caches. **Aide débutants** : #274 à merger.
- **Pièges** : fichiers en CRLF ; erreurs tsc/eslint connues dans `Cadrage/docs/reel*` ; une branche par PR ; pas
  d'import pendant le timer VM 12h/16h Paris. **Hérité** : 983 `stats_box_scores.pf` vides ; pari Memphis à rejouer
  (demander) ; poller VM dryRun -> réel ; probas instables. **Échéance** : bêta Cup 04/12.
