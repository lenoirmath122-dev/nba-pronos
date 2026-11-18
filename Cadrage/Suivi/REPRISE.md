# Reprise — NBA Pronos (18/11/2026, passation 36)
- **Actualité (PR #299 à merger)** : l'onglet Accueil devient « Actualité » (même URL `/home`),
  l'app s'ouvre sur Jouer, barre Jouer · Actualité · Classement · Chat · Profil. Retirés de l'Actualité : Prochain prono,
  À faire aussi, À traiter (admin), Proposer un pari (déjà sur Jouer). Nouvelle carte de nuit, réactions rapides,
  « Répondre » vers le chat pré-rempli, aperçu chat, nuits précédentes (`?nuits=N`). Voir ETAT_ACTUEL §4.6.
- **Mise en service Actualité** : `supabase db push --remote` (migration `20261113150000_recap_reactions.sql`) AVANT
  le déploiement, sinon les réactions échouent (l'écran s'affiche quand même, compteurs à 0). Tester à la main :
  réagir/retirer, « Répondre » (texte pré-rempli puis champ vide après envoi), « Nuit précédente », lien push `/home#recap`.
- **Incident VM 18/11** : disque ext4 abîmé (lecture seule le 16/11, kernel panic le 17/11) -> VM figée, pas de score live.
  Instantané `nba-refresh-avant-reset-20261118` puis reset ; à faire : fsck forcé, alerte « match sans score ». Feuilles de match : clé `.strip()` (#302), se republient au prochain import.
- **PR #296 à merger** : paliers de difficulté 66/53/35/20 %. **Fin novembre** : revoir le palier 2 et re-mesurer les probas des stars.
- **PROCHAIN CHANTIER : étape 5** des probas = paris par période (points/écart à la MT, suites de QT).
- **#295 déployé** : à confirmer sur un vrai pari (« Zion 20+ » doit remonter).
- **En attente** : avatars dans le Chat (`ChatRosterEntry.avatarUrl`) — l'aperçu chat de l'Actualité affiche une initiale en attendant.
- **À tester à la main** : upload avatar/logo, `/rejoindre` en visiteur. **Sécurité** : politique `tmp_upload_instagram_recaps` à vérifier.
- **Bouton admin import box scores** (#284) : jeton `GITHUB_DISPATCH_TOKEN` à poser dans Vercel Prod, redéployer.
- **Quota Vercel Fluid Active CPU** : noter la valeur, décider d'allonger les caches. **Aide débutants** : #274 à merger.
- **Pièges** : une branche par PR ; pas d'import pendant le timer VM 12h/16h Paris ; migrations via `supabase db push --remote` ;
  le service stats ne se redéploie pas seul ; le poller VM ne fait pas de `git pull`. **Hérité** : 983 lignes de présaison
  dans `stats_box_scores` ; pari Memphis à rejouer (demander). **Échéances** : crédit GCP Free Trial 20/11 ; bêta Cup 04/12.
