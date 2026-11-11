# Reprise — NBA Pronos (11/11/2026, passation 30)
- **PROCHAIN CHANTIER : avatars dans le Chat.** Les données existent déjà : `ChatRosterEntry.avatarUrl` et le champ
  `avatarUrl` des messages (`lib/queries/chat.ts`, `ChatSubscriber.tsx`) ne sont pas encore rendus. Réutiliser
  `PlayerIdentity`/la logique de repli du classement : photo > logo d'équipe sur fond blanc (`.avatarOnTeam`) > initiales ;
  clic sur l'avatar = profil du joueur. Penser aux messages en temps réel (roster à enrichir de l'équipe favorite).
- **Visiteurs uniques** (branche `feat/visiteurs-uniques`, PR à merger) : événement `visit` 1x/jour/navigateur, pb_vid posé
  par le serveur (limite 7 j de Safari sur les cookies JS), Vercel Analytics ignore pb_internal, compteur dans Admin > Joueurs.
  **Ordre** : `supabase db push --remote` (migration 20261111230000) PUIS merger. Rapport : `scripts/sql/visiteurs_uniques.sql`.
- **PR #286 mergée** (Chat créer une ligue + /rejoindre, reprise auto cookie `pb_join`, Classement sur la dernière ligue
  cookie `pb_lb_scope`, Profil : roue crantée -> `/profile/modifier`, avatar, logo de ligue réservé au créateur).
  Migration `20261111090000` (buckets avatars/league-logos, `leagues.logo_url`) appliquée en prod. Pas de limite de ligues.
- **Migrations** : `supabase db push --remote` marche maintenant (migration 20261027125048 rapatriée). Taper la commande
  soi-même avec `!` si le classifieur la refuse.
- **À tester à la main** : upload avatar/logo, `/rejoindre` en visiteur. **Sécurité** : politique `tmp_upload_instagram_recaps`
  (upload anonyme) à vérifier/supprimer, voir GAPS_OUVERTS.
- **Bouton admin import box scores** (#284) : jeton `GITHUB_DISPATCH_TOKEN` à poser par l'utilisateur dans Vercel Prod, redéployer.
- **Quota Vercel Fluid Active CPU** : noter la valeur, décider d'allonger les caches. **Aide débutants** : #274 à merger.
- **Pièges** : fichiers en CRLF ; erreurs tsc/eslint connues dans `Cadrage/docs/reel*` ; une branche par PR ; pas d'import
  pendant le timer VM 12h/16h Paris. **Hérité** : 983 `stats_box_scores.pf` vides ; pari Memphis à rejouer (demander) ;
  poller VM dryRun -> réel ; probas instables. **Échéance** : bêta Cup 04/12.
