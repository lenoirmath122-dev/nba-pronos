# Chantier — plan de communication et Match du jour

> **Nature** : vivant. Détail complet du chantier, sorti de
> `GAPS_OUVERTS.md` le 12/10/2026 (section « Plan de communication », reprise telle quelle).
> **À ne lire que quand la session porte sur la communication, le recrutement ou la compétition Match du jour.** Le résumé des points ouverts et la
> prochaine étape restent dans `GAPS_OUVERTS.md` ; quand un point est
> traité, le retirer ici ET là-bas.


> Plan source : `Cadrage/Business/panier_ballon_cadrage_business_communication.md`
> et `panier_ballon_elargissement_octobre.md`, écrits avant l'alpha. Quatre
> étapes décidées le 05/10/2026, à traiter dans cet ordre, une par
> conversation (voir `README.md`, méthode de travail).

- [x] **A. Recaler le plan sur la réalité** — fait le 05/10/2026, voir
  `Cadrage/Business/panier_ballon_plan_recale_octobre_decembre.md`. Décisions :
  bêta sur la phase finale de la Cup (4→11/12), pas la phase de groupes
  (l'app est centrée sur les séries, 4-6 jours de travail) ; canaux en
  parallèle dans 2-5 h/semaine ; contenu de la pause = retours de l'alpha,
  nouveautés produit, compte à rebours. Reste ouvert : que jouent les inscrits
  avant le 4/12 (§5 du plan recalé).
- [x] **C. Socle SEO et vocabulaire** — clos le 06/10/2026 (PR #119 et #121,
  voir `JOURNAL_SESSIONS.md`). Le mot « paris » est conservé volontairement
  dans les métadonnées et sur `/` (toujours avec « sans argent réel »).
  Reste hors de ce point : la landing page soignée (p5-2, version actuelle
  minimale), et `lastModified` du sitemap à mettre à jour à la main quand
  une page change. Toujours écrire `https://panierballon.fr` (avec schéma)
  dans les messages et légendes, sinon pas d'aperçu de lien.
- [ ] **B. Contenu Instagram pendant la pause** — post 5 « Bilan de l'alpha »
  fait et publié le 05/10/2026 (6 slides + légende dans `Cadrage/DA/instagram/Posts/Post 5/`).
  **Plan Instagram oct.-nov. écrit le 06/10/2026** dans `Cadrage/Business/panier_ballon_instagram_octobre_novembre.md`
  (audit, rôle d'Instagram dans le recrutement, calendrier 6/10 → 15/11, textes, cadrage des visuels).
  **Reel R1 v3 prêt le 06/10/2026** (`Réels/panier-ballon-nba-cup-reel-v3.mp4`, fin « Préparation dès le 20/10 ») :
  à publier en S1 une fois le profil remis à neuf ; légende R1 à aligner (sans « Match du jour ») ; refaire la fin si le 20/10 glisse.
  Restent : la suite du calendrier (reel démo, post
  « nouveautés », sondage Story), et le motion design de présentation
  générale de l'app + motions par fonctionnalité (décidé le 05/10, plus
  tard ; à ne produire qu'après un cadrage très précis : script, durée,
  fonctionnalités couvertes, format). Récaps du matin : ne pas les mettre en avant avant de les avoir vus
  avec de vraies données.
- [ ] **D. Recrutement** — plan écrit le 06/10/2026 dans
  `Cadrage/Business/panier_ballon_plan_recrutement_octobre_decembre.md`
  (structure, calendrier, entonnoir, messages-types recalés). Décisions :
  quelques vrais matchs avant le 4/12 ; le commissaire crée sa ligue ; statut
  « fondateur » symbolique pour les ambassadeurs (n'existe pas dans l'app,
  faisabilité à confirmer, ne pas le promettre avant). Reste à faire : cadrer le
  dispositif « vrais matchs » (faisabilité produit non sondée), écrire le mode
  d'emploi d'inscription avec captures, créer le tableau de suivi (hors
  dépôt), envoyer le message aux ambassadeurs le 11/10, puis exécuter le
  calendrier. Les anciens messages « bêta ouverte en octobre » sont périmés.
  **Dispositif « vrais matchs » cadré le 06/10/2026** : compétition `DAILY_MATCH`
  (un match tiré par jour, 20/10 ou repli 01/11 → ~27/11, barème dédié avec
  paris pondérés, un pari perso par match), voir
  `Cadrage/Fonctionnel/nba_pronos_cadrage_competition_match_du_jour.md`.
  Les 6 points ouverts du cadrage sont tranchés (voir §8 du
  cadrage, 06/10/2026) : paris ×0,6, publication 10h Paris avec push, tirage
  aléatoire, tirage par lots. Correctif « veille NY » livré (PR #126), PR 1/4
  (base, moteur, types) mergée (#127) et migrations poussées, PR 2/4 (synchro,
  admin, script de tirage, masquage JS) mergée (#128),
  PR 3/4 (UI joueur : carte jour NY + heure Paris, règles, bracket masqué)
  livrée le 07/10/2026, PR 4/4 (annonce du match du jour dans le push de 10h, groupée avec le récap) livrée le 07/10/2026 (joueur en push avec « Récap du matin » désactivé : pas d'annonce, à confirmer). PR 5 (tirage automatique par cron, 07/10/2026) codée : workflow `daily-match-draw.yml` (5h et 7h UTC) + route `/api/daily-match/draw`, le cron tire dès le 18/10 les jours >= 20/10 (fenêtre de 3 jours) ; sert aussi de test de la récupération automatique du calendrier avant la Cup et les Playoffs, sans couvrir le mapping A7 de la Cup. **3 points à faire par l'utilisateur le soir du 07/10/2026, dans l'ordre** : (1) créer la variable Vercel `OWNER_USER_ID` (id de son compte) puis redéployer après le merge de la PR 5 ; (2) lancer le test (compétition de test seule ACTIVE, workflow manuel `from=to=2026-10-07` + `override`, `dry_run` puis réel avec `push_only_me`) ; (3) **archiver la compétition de test avant 08:00Z le 08/10**. Détail : créer la variable Vercel `OWNER_USER_ID` ; **test du 07/10 au soir** sur une compétition DAILY_MATCH de test (seule ACTIVE, matchs de présaison) via le workflow en manuel (`from=to=2026-10-07`, `override`, d'abord `dry_run`, puis `push_only_me`), puis **archiver cette compétition avant 08:00Z le 08/10** (sinon `recaps.yml` pousse à tous les comptes) ; créer ensuite la vraie compétition DAILY_MATCH en admin avant le 18/10. Tests `onlyUserId` (runRecaps) et tests de route non écrits. Calendrier Highlightly
  2026-27 incomplet (vide du 10/11 au 27/11 au sondage du 06/10) : la route renvoie 500 (issue d'alerte) si le match d'aujourd'hui ou de demain manque.
  **Mise à jour du 07/10/2026 (fenêtre glissante de 7 jours)** : le cron commence le 16/10 (pas le 18/10) et tire 9 jours à l'avance ; la vraie compétition DAILY_MATCH doit donc exister **avant le 16/10 à 5h UTC** (prévu le 14/10 : clôturer la compétition de test après la présaison, puis recréer). À surveiller : (1) la synchro des horaires ne regarde que 4 jours (`SYNC_HORIZON_DAYS`, `lib/sync/schedule.ts`) alors que les matchs sont visibles 7 jours avant, donc un report peut rester affiché 2 à 4 jours ; (2) quota Highlightly, jusqu'à 18 appels/jour si le calendrier est vide (arrêt sous 50 restants) ; (3) Thanksgiving (26/11) sans match probable : alerte 500 pendant 2 jours.
