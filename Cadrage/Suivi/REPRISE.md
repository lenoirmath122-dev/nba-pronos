# Reprise — NBA Pronos (18/11/2026, passation 42)
- **Mode invité : on repart de zéro.** PR #305 (lots A à G) est MERGÉE sur main mais le modèle ne convient pas : elle a créé une
  zone publique parallèle (`/matchs`, `/match/[id]`, `/ce-soir`, `/chat-invite`, PublicShell, modale, bandeau, événements) au lieu
  d'ouvrir la vraie appli. `/` n'a pas changé, le drapeau `GUEST_APP_MODE` n'a jamais été codé.
- **Décision (18/11)** : (1) SUPPRIMER tout le code des lots A à G (branche + PR de revert, jamais sur main) pour ne pas alourdir ;
  (2) repartir sur : l'invité ouvre la vraie appli (`/play`, même navigation), compte exigé seulement au moment de parier ;
  `/` envoie les invités vers `/play`, les connectés vers `/home`. Chat Général en lecture ; `/home` et `/profile` restent derrière le compte.
- **Premier pas** : lister ce que `/play` lit de la session (`APP_ZONE_PREFIXES` dans `proxy.ts`) pour jauger l'ouverture aux invités.
  Réutilisable si utile avant suppression : requireAuth, modale de compte, action en attente, brouillon du chat, événements funnel.
- **Migrations déjà en prod** (poussées 18/11) : `20261118090000` (anon limité aux colonnes publiques de `users`, à GARDER : correctif
  de sécurité) ; `20261118120000` (événements invité du funnel) : décider de la garder ou d'écrire une migration de retrait.
  Le CI `check-static-routes.mjs` a eu `/matchs` et `/chat-invite` ajoutés : à retirer avec la suppression. Renommer le compte à pseudo e-mail (id `5b39327a…`).
- **Build local** : échoue sur `Cadrage/docs/reel-v2-pack` (gitignoré, remotion absent) ; le déplacer le temps du build.
- **Probas** : #295 déployé, à confirmer sur un vrai pari. **Fin novembre** : mesurer les paliers 66/53/35/20 % (paris après le 12/11).
- **Autres chantiers en attente** : avatars dans le Chat (`ChatRosterEntry.avatarUrl`) ; préparation bêta Cup (04/12).
- **À tester à la main** : upload avatar/logo, `/rejoindre` en visiteur. **Sécurité** : politique `tmp_upload_instagram_recaps` à vérifier/supprimer.
- **Bouton admin import box scores** (#284) : jeton `GITHUB_DISPATCH_TOKEN` à poser dans Vercel Prod. **Aide débutants** : #274 à merger.
- **Pièges** : fichiers en CRLF (éditer via script Python en UTF-8) ; pas d'import pendant le timer VM 12h/16h Paris ; migrations via
  `supabase db push --remote --yes` (à lancer par l'utilisateur) ; le service stats ne se redéploie pas seul. **Échéances** : GCP Free Trial 20/11 ; bêta Cup 04/12.
