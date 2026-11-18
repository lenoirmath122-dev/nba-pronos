# Reprise — NBA Pronos (18/11/2026, passation 44)
- **Invité dans la vraie appli : PR #309 mergée et recettée (18/11)**. SEO : `/play` ouvert aux robots (titre d'accueil, canonique,
  sitemap ; sous-pages `/play/` toujours exclues), PR `fix/seo-play` à merger. Reste : mesurer le quota CPU Vercel (rendu dynamique de
  `/play` par les invités) d'ici quelques jours ; décider de supprimer l'ancienne accueil jouable `app/(public)/page.tsx` + `lib/publicHome/*`.
- **Migrations en prod** : `20261118090000` (anon limité aux colonnes publiques de `users`, à GARDER) ; `20261118120000` (événements funnel
  invité, gardée). Renommer le compte à pseudo e-mail (id `5b39327a…`).
- **Build local** : échoue sur `Cadrage/docs/reel-v2-pack` (gitignoré, remotion absent) ; le déplacer le temps du build. tsc/lint remontent
  aussi des erreurs dans `Cadrage/docs/reel*` (préexistantes, hors périmètre).
- **Probas** : #295 déployé, à confirmer sur un vrai pari. **Fin novembre** : mesurer les paliers 66/53/35/20 % (paris après le 12/11).
- **Autres chantiers en attente** : avatars dans le Chat (`ChatRosterEntry.avatarUrl`) ; préparation bêta Cup (04/12).
- **À tester à la main** : upload avatar/logo, `/rejoindre` en visiteur. **Sécurité** : politique `tmp_upload_instagram_recaps` à vérifier/supprimer.
- **Bouton admin import box scores** (#284) : jeton `GITHUB_DISPATCH_TOKEN` à poser dans Vercel Prod. **Aide débutants** : #274 à merger.
- **VM nba-refresh** : noyau Debian `6.1.0-55` fautif, revenue au `6.1.0-54` (détail dans GAPS_OUVERTS).
- **Pièges** : fichiers en CRLF (script Python UTF-8) ; pas d'import pendant le timer VM 12h/16h Paris ; migrations via
  `supabase db push --remote --yes` (par l'utilisateur) ; le service stats ne se redéploie pas seul. **Échéances** : GCP Free Trial 20/11 ; bêta Cup 04/12.
