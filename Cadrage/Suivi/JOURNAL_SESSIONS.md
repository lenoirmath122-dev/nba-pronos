# Journal des sessions — NBA Pronos

> **Nature** : vivant — append-only. **Une entrée = une ligne de 300
> caractères maximum** : `- Titre-résumé (JJ/MM/AAAA) — PR #n`. Le détail
> (fichiers, commandes, vérifications) vit dans `git log` et les PR, pas ici.
> Ce fichier n'est PAS lu en début de session (voir `REPRISE.md`) ; on ne
> l'ouvre que pour retrouver quand/pourquoi une décision a été prise.
>
> Compressions : 18/09/2026 (texte intégral jusqu'au 18/09 dans
> `archive/JOURNAL_SESSIONS_archive_jusquau_2026-09-18.md`) et 12/10/2026
> (entrées d'octobre ramenées à leur titre, texte intégral dans
> `archive/JOURNAL_SESSIONS_archive_jusquau_2026-10-12.md`).
---

## Sessions antérieures au 16/07/2026

Reconstruites a posteriori depuis `git log` et l'ancien
`ETAT_DEVELOPPEMENT_PROTOTYPE.md` — frontières exactes entre sessions non
fiables au-delà de ce qui est explicitement noté dans l'archive.

## Juillet 2026

- Session du 16/07/2026
- Session du 18/07/2026 (dépôt neuf + T1/T2/T3 + migrations 1-4)
- Session du 18/07/2026 (suite — T4 : spec technique synchro API)
- Session du 19/07/2026 (T5 : spec technique scoring)
- Session du 19/07/2026 (suite — T6a : squelette Next.js)
- Session du 19/07/2026 (suite — T6b : couche d'écriture)
- Session du 19/07/2026 (suite — T6c : Realtime + rendu des états actés)
- Session du 19/07/2026 (suite — T7 : design system)
- Session du 19/07/2026 (suite — démarrage de l'implémentation post-T7)
- Session du 20/07/2026 (passe design maquettes V1)
- Session du 21/07/2026 (consolidation design — logos, icônes de nav, bandeau)
- Session du 22/07/2026 (Classement + Bracket : écrans partagés visiteur/joueur)
- Session du 23/07/2026 (données de test, correctif RLS Classement, écran Matchs)
- Session du 24/07/2026 (retours du premier test utilisateur réel : logos, déconnexion)
- Session du 24/07/2026 (suite — hub Jouer temporaire)
- Session du 24/07/2026 (suite — lot « Mes pronos », 5 étapes)
- Session du 25/07/2026 (correctif pastille de logo)
- Session du 25/07/2026 (suite — entête Matchs + correctif des 30 logos)
- Session du 25/07/2026 (suite — commit/push + amendements de specs)
- Session du 26/07/2026 — Écran Nouveau pari (« Paris »), spec close + migrations + code
- Session du 27/07/2026 (suite) — Test manuel navigateur, bandeau sticky, saisie inline dans Matchs
- Session du 27/07/2026 (suite) — Écran Bracket personnel (remplissage), spec rédigée en séance + code + tests
- Session du 27/07/2026 (suite) — Déploiement Vercel, activation de l'inscription, 1er admin réel
- Session du 27/07/2026 (suite) — Écran Profil, spec rédigée en séance + code + tests, thème clair/sombre câblé
- Session du 27/07/2026 (suite) — Écran Mes paris, spec rédigée en séance + code + tests, correctif migration
- Session du 27/07/2026 (suite) — Tableau de bord admin (premier écran du lot Admin)
- Session du 27/07/2026 (suite) — Correctif ponctuel : dates du jeu de données de test
- Session du 27/07/2026 (suite) — File de validation des paris (2e écran du lot Admin)
- Session du 27/07/2026 (suite) — Gestion des joueurs (3e écran du lot Admin)
- Session du 27/07/2026 (suite) — Historique des logs (4e écran, dernier sans dépendance T5)
- Session du 27/07/2026 (suite) — Correctif de latence : région Vercel
- Session du 27/07/2026 (suite) — Chantier T5, lot 1/4 : moteur pur
- Session du 27/07/2026 (suite) — Chantier T5, lot 2/4 : writer `series.official_*`
- Session du 27/07/2026 (suite) — Chantier T5, lot 3/4 : orchestration (`recompute*`)
- Session du 27/07/2026 (suite) — Lot 4a : bouton « Recalculer »
- Session du 27/07/2026 (suite) — Lot 4b : file de résolution des paris
- Session du 27/07/2026 (suite) — Lot 4c : file des requêtes — CHANTIER T5 CLOS
- Session du 27/07/2026 (suite) — Ordre de reprise fixé + vulnérabilités npm consignées
- Session du 27/07/2026 (suite) — Chantier Gestion des compétitions, lot 1/3 : création
- Correctif — dialogue de validation Matchs (27/07/2026, suite)
- Correctif des 12 vulnérabilités npm (27/07/2026, suite)
- Gestion des compétitions — lots 2/3 et 3/3 (27-28/07/2026, suite)
- T4 — implémentation (28/07/2026)
- Suite du dry-run T4 : simulation étendue, test manuel utilisateur, 2 gaps trouvés (28/07/2026, suite)
- Commit T4 + correction des 2 gaps + clôture du dry-run (28/07/2026, suite)
- Vrai hub Jouer — spec rédigée en séance et codée (28/07/2026, suite)
- Commit du hub Jouer, revue des gaps, centralisation prono/pari (28/07/2026, suite)
- Commit du lot centralisation, vérif Vercel, largeur d'écran (28/07/2026, suite)
- Audit structurel T1→T8 / D1-D6 (28/07/2026, suite)
- Résolution de 5 des 7 écarts trouvés par l'audit (28/07/2026, suite)
- T6a — écran reset-password (28/07/2026, suite)
- T8 — spec Déploiement + planificateur + nettoyage (28/07/2026, suite, dernier écart de l'audit)
- Commit/push du lot audit + les 3 actions externes T8 (28/07/2026, fin de l'arc)
- Révélation publique des paris + contestation d'un pari refusé/résolu (28/07/2026, suite)
- Commit/push du lot otherBets + contestation (28/07/2026, fin)
- T6c — Realtime sur `series` (29/07/2026)
- 4 points UI mineurs (29/07/2026, suite)
- Rappels ciblés — canal Push (29/07/2026, fin de journée)
- Validation en conditions réelles des rappels ciblés + 3 correctifs (29/07/2026, fin de journée)
- Système de ligue (30/07/2026)
- Vue admin "Qui manque à l'appel" (30/07/2026)
- Petit correctif — lien de sortie du panneau admin (30/07/2026)
- Superlatifs de fin de compétition + écran Historique (30/07/2026)
- Test au clic en conditions réelles — missing + superlatifs/Historique (30/07/2026, fin de session)
- Discussion navigation + 2 bugs réels trouvés en creusant (30/07/2026, suite)
- Page "profil joueur" + pseudo cliquable partout (30/07/2026, fin de session)
- Réorganisation de Profil en sous-onglets (30/07/2026, fin de session)
- Couleurs d'équipe sur Profil — essayée puis abandonnée (30/07/2026, fin de session)
- Sélecteur d'équipe favorite en menu déroulant (30/07/2026, fin de session)
- Reclassement du backlog + refonte lisibilité du Bracket (30/07/2026, fin de session)
- Filtre par ligue sur Mes pronos + Bracket, replis "Plus d'options" (30/07/2026, fin de session)
- Tutoriel joueur (31/07/2026)
- Création de compétition NBA Cup + dry-run réel de la synchro (31/07/2026, suite)

## Août 2026

- Commit/push du chantier NBA Cup (02/08/2026)
- Stepper d'écart repensé sous l'équipe vainqueur, écran Matchs (02/08/2026, suite)
- Bug « Paris séries » Accueil/hub Jouer : affiches du bracket personnel au lieu des vraies affiches (04/08/2026)
- Écran Nouveau pari : carte de saisie masquée tant qu'aucune cible n'est choisie (04/08/2026)
- Projet Supabase mis en pause après 7 jours : cause racine trouvée et corrigée (04/08/2026)
- Raccourci « Parier sur cette série » depuis le Bracket global (04/08/2026)
- Couleurs d'équipe sur Profil — reprise cadrée par maquettes, cette fois codée (04/08/2026)
- Nouvel onglet Stats — Profil (04/08/2026)
- Stats : total de points en grand (05/08/2026)
- DA : fond photo plein écran + cartes en verre, fond personnalisable (05-06/08/2026)
- Thème à 3 choix : Sombre / Clair / Photo (06/08/2026, suite)
- Badges permanents — cadrage complet + code phase 1 (08-09/08/2026)
- Badges permanents — couleurs par palier (09/08/2026, suite immédiate)
- Badges permanents — phase 2 : Métronome + Pilier (09/08/2026, suite)
- Badges permanents — phase 3 : Fidèle, catalogue de base complet (09/08/2026, suite)
- Badges permanents — interaction "carte retournée" au clic (10/08/2026)
- Badges permanents — astuce de découverte du clic (10/08/2026, suite)
- Badges permanents — icônes par badge, chantier clos (10/08/2026, suite)
- Badges permanents — icône agrandie et réordonnée (10/08/2026, suite)
- Badges permanents — remplacement des icônes stopgap par des visuels IA (10/08/2026, suite) : EN COURS, MIS EN PAUSE
- Rattrapage de suivi : reprise après la pause du 10/08/2026, migration #28 poussée (13/08/2026)
- Rattrapage de suivi : 9 commits des 14-15/08/2026 jamais documentés (16/08/2026)
- Audit UX + code : parcours réel + revue multi-agents (16/08/2026)
- Correctif : désync `isLive`/`isDecided` en direct sur le Bracket (16/08/2026)
- Correctif : bouton "Parier" trompeur sur série terminée (16/08/2026)
- Correctifs : hydratation Profil + 4 points mineurs de l'audit (16/08/2026)
- Discussion produit : les 4 questions de l'avis expert (16/08/2026)
- Bracket en arbre visuel connecté (Vue B) — 1er chantier produit (16/08/2026)
- Correctif : séries du 1er tour inatteignables au scroll, Vue B paysage (16/08/2026)
- Vue B (arbre connecté) devient le défaut desktop/paysage (16/08/2026)
- Remplissage du bracket : poster interactif comme mode principal (16/08/2026)
- Arbre toujours par défaut + alignement des cartes fusionnées (17/08/2026)
- Correctif : libellés de tour mal positionnés après l'alignement des cartes (17/08/2026)
- Finales de conférence + Finale NBA toujours sur la même ligne (17/08/2026)
- Nouveau : suppression manuelle d'un match, écran admin (17/08/2026)
- Nettoyage des comptes bots de simulation + 2 correctifs remplissage (17/08/2026)
- Nouveau : remise à zéro du bracket personnel (17/08/2026)
- Nouveau/modifier un pari : fenêtre centrée au lieu d'une page (17/08/2026)
- Poster : scores à côté de la carte (vers le centre), plus en dessous (17/08/2026)
- Poster : score en menu déroulant, en face de l'équipe vainqueure (17/08/2026)
- Accueil : polish visuel (icônes, liseré d'urgence, rang en avant, pastilles, feed illustré) (18/08/2026)
- Mes paris : suppression d'un pari encore modifiable + boutons harmonisés (18/08/2026)
- Rattrapage de suivi : `ETAT_ACTUEL.md`/`GAPS_OUVERTS.md` pas à jour depuis le 15/08/2026 (18/08/2026)
- Onglet Jouer : cadrage de la fusion Mes pronos / Résultats (18/08/2026)
- Avancement de la compétition active avec TestJoueur1-4 (18/08/2026)
- Bracket : score conservé, points du prono, thème Photo perdu sur Mes pronos (18/08/2026)
- 2e vague d'avancement de la compétition, après les pronos de l'utilisateur (18/08/2026)
- Résultats : filtre par date en bandeau défilant (18/08/2026)
- DateStrip : défilement auto au chargement + barre masquée (18/08/2026)
- Mes pronos/Résultats : partage par statut au lieu de 3 jours (18/08/2026)
- Nettoyage : matchs FINISHED avec une date future (18/08/2026)
- Résultats : détail des points du prono entre parenthèses (18/08/2026)
- Accueil : feed « Ça vient de tomber » cliquable (18/08/2026)
- Correctif : lien du feed atterrissait sur la page mais pas la ligne (18/08/2026)
- Feed : le lien mène aussi au bon jour (18/08/2026)
- Accueil : numéro de match dans « À traiter » (18/08/2026)
- Accueil : numéro de match aussi dans la section Paris (18/08/2026)
- Accueil : numéro de match aussi dans « Ça vient de tomber » (18/08/2026)
- Accueil : cartes dépliables (18/08/2026)
- Accueil : compteur sur les cartes + renommages (18/08/2026)
- Accueil : numéro de match aussi dans « Ça vient de tomber » (18/08/2026)
- Projet Data NBA — reprise, feature engineering, lien avec le scoring (19-20/08/2026)
- Projet Data NBA — 8 modèles construits, persistance, bug DNP, correctif Poisson (20/08/2026, suite)
- Projet Data NBA — fetch terminé + réentraînement complet enchaînés en fond (20/08/2026, fin de session)
- Ajustements visuels validés (session DA séparée) — implémentation (20/08/2026)
- Projet Data NBA — pourcentages de tir, approche Binomiale validée sur FT% (20/08/2026, suite)
- Projet Data NBA — généralisation FG%/3P%, Phase 1 (largeur) terminée (20/08/2026, suite immédiate)
- Projet Data NBA — testeur generique des 12 modeles, autonomie utilisateur (20/08/2026, suite)
- Projet Data NBA — écart double-double Wembanyama, limite de conception trouvée en usage réel (20/08/2026, suite)
- Fix : fond blanc Login/Signup/Reset en prod Vercel (20/08/2026, suite)
- Login/Signup/Reset : photo forcée même sans session (20/08/2026, suite)
- Projet Data NBA — load_to_sqlite.py plus robuste, fetch étendu rebuild (20/08/2026, suite)
- Nouvelle page /regles (20/08/2026, suite)
- Retrait du tutoriel "Comment jouer ?" (21/08/2026)
- Projet Data NBA : Phase 3, overdispersion FT%/FG%/3P% — Beta-Binomial adopté sur FT% (21/08/2026)
- Projet Data NBA : réentraînement 5 saisons, biais FT% diagnostiqué, Phase 4 démarrée (21/08/2026, suite)
- Projet Data NBA : Phase 4, architecture sans état + Cloud Run + migration Supabase (21/08/2026, suite)
- Projet Data NBA : déploiement Cloud Run réel, service EN LIGNE (21/08/2026, suite)
- Projet Data NBA : rafraîchissement quotidien écrit et validé, Phase 4 code complet (21/08/2026, suite)
- Projet Data NBA : 1er run réel du cron, optimisation timeout, Phase 4 close (21/08/2026, suite)
- Phase 5 démarrée : structuration IA des paris persos, raccordement réel dans l'appli (21/08/2026, suite)
- Structuration IA vérifiée hors-interface, 1 bug réel corrigé (21/08/2026, suite)
- 1er test réel via l'interface -- bug "Junior" vs "Jr." trouvé et corrigé (21/08/2026, suite)
- Design révisé : auto-validation au lieu de "admin garde la main" (21/08/2026, suite)
- Contexte de match ajouté à la structuration IA -- 2 bugs réels corrigés (21/08/2026, suite)
- Fix observabilité : is_calculable=false écrit explicitement (21/08/2026, suite)
- Joueur hors du match visé : proba 0% au lieu d'un rejet silencieux (21/08/2026, suite)
- README.pdf mis à jour + calibration réelle des seuils proba->difficulté (21/08/2026)
- Phase 5 close, point 5 (barème du fallback) parqué par décision (22/08/2026)
- Optimisation du coût des appels IA de structuration (22/08/2026)
- Repli automatique des cartes prono/pari dans "Mes pronos" (22/08/2026)
- Fix : superposition des demi-finales NBA Cup dans l'arbre (22/08/2026)
- Investigation pari IA non reconnu + fix affichage "CHI −4" (22/08/2026)
- Fix : find_player() non paginé + pari annulé bloquant + reset finale NBA Cup (22/08/2026)
- Suite et clôture : chaîne complète Risacher résolue (22/08/2026)
- Phase 6 lancée : résolution automatique des paris IA (22/08/2026)
- Phase 6, blocs 2-3 : résolution automatique construite (22/08/2026)
- Phase 6 : vérification complète en conditions réelles (22-23/08/2026)
- Cadrage des paris SÉRIE, non codé (23/08/2026)
- Suite du cadrage paris SÉRIE : modèle de victoire par match (23/08/2026)
- Paris SÉRIE, pièce a0 codée et vérifiée (23/08/2026)
- Gap Supabase trouvé (team_id/stats avancées manquantes), pause décidée (23/08/2026)
- Paris SÉRIE, bloquant Supabase levé -- contexte équipe en production (23/08/2026, reprise)
- Paris SÉRIE, pièce (c) -- mécanisme générique d'agrégation (23/08/2026, suite)
- Paris SÉRIE, pièce (d) -- extraction IA étendue (23/08/2026, suite)
- Paris SÉRIE, redéploiement Cloud Run + pièce (e) résolution (23/08/2026, suite)
- Paris SÉRIE, 1er test réel + limite de périmètre découverte (23/08/2026, suite)
- Paris SÉRIE, 2e essai réel -- limite du calendrier non synchronisé (23/08/2026, suite)
- Paris SÉRIE, 3e essai réel -- vrai bug de saison trouvé et corrigé (23/08/2026, suite)
- Bug préexistant trouvé : pari série VALIDATED invisible partout (23/08/2026, suite)
- Pari série visible : ajustement affichage au clic (23/08/2026, suite)
- Pari série : petite indication sur la carte repliée (23/08/2026, suite)
- Pièce (a) -- cadrage posé, pas codé (23/08/2026, suite)
- Pièce (a) -- codée et testée (23/08/2026, suite immédiate)
- Pièce (a) suite -- rebonds d'équipe, les 2 formes (23/08/2026, suite)
- Pièce (a) suite -- généralisation ast/fg3m/stl/blk (23/08/2026, même jour)
- Nouveau chantier : liste réelle des 429 paris (23/08/2026, même jour)
- Comparaison/duel (24/08/2026, chantier suivant)
- Discussion coût des tokens IA (24/08/2026, avant le chantier combo)
- Combo multi-conditions (24/08/2026, chantier suivant -- même jour)
- Prolongation / overtime (24/08/2026, chantier suivant)
- Fix : la catégorie auto-validée reflète le vrai bet_subject (24/08/2026)
- Gap noté : pertes de balle (tov), pas encore une stat pariable (24/08/2026)
- % tir équipe (24/08/2026, chantier suivant -- session interrompue puis reprise)
- % tir équipe : redéploiement Cloud Run + vérification prod (24/08/2026, même jour)
- Pari période (équipe + joueur) -- dernier chantier de la liste des 429 paris (24/08/2026)
- Pari période -- redéploiement Cloud Run + 2 bugs réels trouvés en testant via l'appli (24/08/2026, même jour)
- Plan de reprise post-audit + étape 1 "5 majeur/banc" (24/08/2026, même jour)
- Étape 2 (partielle) "petits gains groupés" (24/08/2026, même jour)
- Étape 2 terminée -- entraînement +/- et fga (24/08/2026, même jour)
- Étape 3 du plan de reprise -- comptage roster-wide (25/08/2026)
- Commit étape 3, puis étape 4 -- meilleur marqueur (25/08/2026, même jour)
- Commit étape 4, puis étape 5 -- événements de match (25/08/2026, même jour)
- Étape 6 (événements granulaires) + étape 7 (OU imbriqué) + étape 8 (guide de rédaction) -- fin du plan de reprise post-audit (25-26/08/2026)
- Modèle joueur+période entraîné + 2 gaps restants identifiés (26/08/2026)
- Gap not_in_match COMPARISON/COMBO corrigé (26/08/2026)
- Gap not_in_match COMPARISON/COMBO : redéployé et vérifié en prod (26/08/2026)
- 6 matchs fantômes nettoyés dans "Mes pronos" (27/08/2026)
- CANCELLED regroupé avec FINISHED : Mes pronos → Résultats (27/08/2026)
- 2 matchs fantômes du 17/08 nettoyés + règle auto-mode ajoutée (27/08/2026)
- Compétition fictive NBA Cup — alpha potes, conception + 3 scripts (27/08/2026)
- 2 ajouts au backlog : chat et badges sur la page perso (27/08/2026)
- Badges épinglés dans le bandeau du profil, cadré puis codé (27/08/2026)
- Badges épinglés : 2 corrections signalées par l'utilisateur (27/08/2026)
- Badges épinglés : aussi sur la page perso publique /players/[userId] (27/08/2026)
- Intégration du logo (icônes d'app) + conflit avec le cadrage business découvert (27/08/2026)
- Renommage provisoire "Panier Ballon" + logo étendu à la nav/écrans de connexion (27/08/2026)
- Bug réel : nav visiteur invisible sur Login/Signup/Reset (27/08/2026)
- Chat — Général + par ligue (27/08/2026)
- Chat — liste de canaux + notifications par canal (27/08/2026, suite)
- Bug réel : thème Photo absent sur /chat (27/08/2026)
- Notification de canal de chat -- simplifiée, puis en icône (28/08/2026)
- Bug réel : policy UPDATE manquante sur push_subscriptions (28/08/2026)
- Réorganisation de Cadrage/ (28/08/2026)
- Compétition fictive NBA Cup -- alpha potes, préparation complète (28/08/2026)
- Bug réel : matchs créés loin à l'avance invisibles dans "Mes pronos" (28/08/2026)
- Barres de scroll masquées partout (28/08/2026)
- Audit de /regles contre le code réel + bug de puces corrigé (28/08/2026)
- Boutons d'aide contextuels "?" vers les règles (RuleHelpButton) (28/08/2026)
- NBA Cup alpha : demies et finale pré-sélectionnées par anticipation (28/08/2026)
- Visuels Instagram : polices installées, post-1 corrigé puis converti en 4:5 (28/08/2026)
- Stratégie hashtags Instagram (28/08/2026)
- Nouvelle fonctionnalité : bouton "Signaler" (bug report) pour l'alpha/bêta (28/08/2026)
- 2 bugs réels trouvés en testant sur mobile + confirmation du mot de passe (28/08/2026)
- Audit de sécurité complet + remédiation critique/élevé/moyen (29-30/08/2026)
- Bandeau LiveTicker épinglé au-dessus de la TabBar (30/08/2026)

## Septembre 2026

- Bilan global + démarrage du chantier fiabilité & QA (01/09/2026)
- Reprise du projet : bilan de reprise, hyperparamètres commités, auto-révélation NBA Cup alpha, bug déploiement Cloud Run (02/09/2026)
- Rafraîchissement quotidien Supabase en échec depuis le 29/08 -- clé service_role legacy jamais tournée dans un secret CI (06/09/2026)
- Réentraînement `vs_adversaire` (8 stats) retrouvé fait mais jamais clos (06/09/2026)
- Pertes de balle (tov) -- nouvelle stat pariable (06/09/2026)
- Derniers 2 gaps "paris personnalisés IA" -- paris composés + formulation période (06/09/2026)
- Phase 0 de la feuille de route + rotation de clé Resend qui révèle 3 bugs réels sans rapport (07/09/2026)
- Phase 0 close : rotation SYNC_SECRET, redéploiement Cloud Run, Sentry (07/09/2026)

## Octobre 2026

- Retrait volontaire du skill `task-observer` (03/10/2026) — PR #92
- Retours de l'alpha NBA Cup rangés et confrontés à l'avancement (03/10/2026)
- Notifications app fermée
- p3-3 vérifié sur téléphone (03/10/2026) — PR #99
- Carte d'activation des notifications sur l'Accueil (04/10/2026, p3-13)
- Petites corrections issues de l'alpha (04/10/2026, p3-4)
- Bracket de consultation `/bracket` réduit à l'arbre (04/10/2026, suite de p3-4) — PR #102
- p3-13 et p3-4 (y compris `/bracket` en arbre seul) vérifiés sur téléphone par l'utilisateur (04/10/2026) après merge des PR #101, #102 et #103
- Retour visuel des actions (04/10/2026, p3-5)
- Préparation de la clôture de l'Alpha NBA Cup
- Clôture de l'Alpha NBA Cup + retrait de son automatisation (04/10/2026)
- Popup « Pari validé » (04/10/2026)
- p3-5 vérifié sur téléphone + règle du joueur qui ne joue pas (04/10/2026, p3-15)
- Joueur absent du match (04/10/2026, p3-14) — PR #108
- Popup des autres joueurs dans Résultats (04/10/2026, p3-6) — PR #109
- Messages de chat non lus (04/10/2026, p3-7) — PR #110
- Bandeau du prono façon télé (05/10/2026, p3-8) — PR #111
- Badges : écusson + popup « nouveau badge » (05/10/2026, p3-9) — PR #113
- Popup « nouveau badge » juste après un geste (05/10/2026, gap ouvert de p3-9) — PR #114, #115
- Paris sans joueur identifié, au-delà du cas simple (05/10/2026, gap ouvert de p3-14) — PR #116
- Récaps du matin, journalier et hebdo + débrief des matchs (05/10/2026, p3-10 + p3-11) — PR #117
- Plan de communication recalé, étape A (05/10/2026)
- Plan de communication, étape B : carrousel « Bilan de l'alpha » (05/10/2026)
- Plan de communication, étape C : socle SEO et vocabulaire (05/10/2026)
- Nouveau logo intégré (05/10/2026)
- SEO, point C.2 : contrôle en production (06/10/2026)
- SEO, point C.3 : image d'aperçu (06/10/2026)
- SEO, point C.4 : `lastModified` du sitemap par page (06/10/2026)
- SEO, point C clos (06/10/2026) — PR #121
- Plan de communication, étape D : plan de recrutement (06/10/2026)
- Cadrage de la compétition « Match du jour » (06/10/2026) — PR #123
- « Match du jour » : 6 points du cadrage tranchés (06/10/2026)
- Correctif « veille NY » dans `syncResults` (06/10/2026)
- Match du jour, PR 1 sur 4 : base de données, moteur de score, types (07/10/2026)
- Match du jour, PR 2 sur 4 : synchro, admin, script de tirage, masquage des jours futurs (07/10/2026)
- Match du jour, PR 3 sur 4 : UI joueur et règles (07/10/2026)
- Match du jour, PR 4 sur 4 : annonce dans le push de 10h (07/10/2026)
- Match du jour, PR 5 : tirage automatique par cron (07/10/2026)
- Jouer : les matchs commencés quittent Mes pronos pour Résultats (06/10/2026)
- Match du jour : test réel de la PR 5 et du push propriétaire (06/10/2026)
- Instagram : Reel R1 v3, scène finale « Préparation dès le 20/10 » (06/10/2026)
- Import des box scores : trace `STATS_IMPORT`, mode strict, test de résolution (07/10/2026) — PR #134
- Highlightly testé comme source de box scores, test Cloud Shell de stats.nba.com (07/10/2026)
- Import des box scores sur une VM Compute Engine, PR 1 (07/10/2026)
- Import des box scores : VM en service, PR 2 déclencheur GitHub et watchdog (07/10/2026)
- Import des box scores : étape 7 faite, bouton et watchdog verts (07/10/2026) — PR #138
- Import des box scores : nettoyage GCP (07/10/2026)
- Match du jour : publication en fenêtre glissante de 7 jours (07/10/2026)
- Enrichissement des modèles / types de paris : cadrage (07/10/2026)
- Enrichissement des modèles : étape 1 détaillée, ajout de la découverte (07/10/2026)
- Enrichissement des modèles : étape 1, PR 1 B-lite faite, PR 2 planifiée (07/10/2026)
- Enrichissement des modèles : étape 1, PR 2 diagnostic de non-calcul (07/10/2026)
- Enrichissement des modèles : inventaire des paris et arbitrage S1 à L8, scénario A retenu (07/10/2026)
- Résultats NBA : PR B, poller sur la VM en dryRun + secours (08/10/2026)
- Résultats NBA : PR C, repli Highlightly, watchdog et correctifs groupés (08/10/2026)
- Récap du matin absent : crons GitHub en retard, bascule sur cron Vercel (09/10/2026) — PR #151
- Saisie du pari perso simplifiée, justification à la résolution (09/10/2026)
- Popup hebdomadaire générée par LLM, cadrage (09/10/2026)
- Enrichissement des modèles : Lot 0, mesure des paris réels et cache LRU des modèles (09/10/2026) — PR #154
- Enrichissement des modèles : cache déployé, instabilité des probas mesurée, reprise sur Memphis (09/10/2026, suite) — PR #154
- Idée : classement hebdomadaire avant la NBA Cup (11/10/2026)
- Classement hebdomadaire : investigation et stratégie validée (11/10/2026)
- Classement hebdomadaire : lot 0, snapshots figés (11/10/2026) — PR #155
- Classement hebdomadaire : lot 1, calcul, figement, palmarès (11/10/2026)
- Classement hebdomadaire : lot 2, vue Semaine du Classement (11/10/2026)
- Classement hebdo : lot 3, récap hebdo manuel avec champion (11/10/2026) — PR #158
- Classement hebdo : lot 4, Palmarès au Profil (11/10/2026)
- Classement hebdo : lot 5, popup hebdo LLM, étapes 1 et 2 du cadrage (11/10/2026)
- Classement hebdo : lot 5, popup hebdo LLM, présélection, historique et prompts v4 (11/10/2026)
- Classement hebdo : lot 5, point 7 (modèles) et premier essai réel des prompts (11/10/2026)
- Classement hebdo : lot 5, prompt rédacteur v5 et second essai ciblé (11/10/2026)
- Classement hebdo : lot 5, plan technique de la popup hebdo LLM (11/10/2026)
- Classement hebdo : lot 5, décisions du plan technique (11/10/2026)
- Classement hebdo : lot 5, PR 1 données de la popup hebdo (11/10/2026) — PR #167, #166
- Classement hebdo : lot 5, PR 2 client LLM de la popup hebdo (12/10/2026)
- Classement hebdo : lot 5, PR 3 pipeline de la popup hebdo (12/10/2026)
- Instagram : Reel de clôture du test (v3, 30 s, texte animé, chiffres lus en base, enjeux de saison) et légende, prêts à publier (12/10/2026)
- Accueil jouable et pronos invités : plan d'attractivité repris, tâches 1 à 3 (vérifications, migrations `PENDING`/préférences/agrégats, requêtes de l'accueil), branche locale non poussée (19/10/2026)

## Référence

Détail complet de chaque session (contexte, échanges avec l'utilisateur,
code, SQL, vérifications empiriques pas à pas) jusqu'au 18/09/2026 :
`archive/JOURNAL_SESSIONS_archive_jusquau_2026-09-18.md` ; jusqu'au 12/10/2026 :
`archive/JOURNAL_SESSIONS_archive_jusquau_2026-10-12.md`.
- Nettoyage des gaps : chantiers vérifiés contre origin/main, PR #170-#188 retirées des points ouverts, REPRISE réécrite (20/10/2026)
- Nettoyage du suivi : gaps contre origin/main (PR #189), refonte-ux supprimée, dépôt principal sur main ; prochaine étape = essai réel e-mails 1B (20/10/2026)
- Crons heartbeat/snapshot/bracket sur Vercel (#191) et correctif Memphis (#192) constatés mergés ; passation ; prochaine étape = essai réel e-mails 1B puis enrichissement des modèles (20/10/2026)
- Seuils inclusifs (#195) : « au moins N » converti en code, schéma structureBet au plafond de grammaire (enum AT_LEAST/AT_MOST) ; crons Vercel (#194) ; prochaine étape = Lot 1 (S1 d'abord) (20/10/2026)
- Branche fix/cron-bracket-hobby constatée doublon de #194 et supprimée ; passation ; prochaine étape = Lot 1 enrichissement modèles (S1 d'abord) (20/10/2026)

- Lot 1 S1 livré (#198) : pf (modèle, migration, backfill prod) + dreb/fgm/ftm/fta composés ; Cloud Run redéployé, 5 stats testées en réel ; prochaine étape = S4 (20/10/2026)
- Lot 1 S4 partiel livré (#200) : stat win (vainqueur) dans le combo, corrélation vainqueur × points d'équipe corrigée ; reste combo période + match entier ; Cloud Run à redéployer (20/10/2026)

- Lot 1 S4 fin (PR #202) : combo match entier + période (qwon, win_q1..h2, mixed_combo, vrais appels OK) ; Cloud Run à redéployer après merge ; prochaine étape = S3 + S8 (20/10/2026)

- Lot 1 S3 + S8 livrés (#203) : margin (écart final signé, handicap, tranches) et starter (titulaire/remplaçant), 5 vrais appels IA OK ; Cloud Run à redéployer ; prochaine étape = exactement N / égalité / score exact (21/10/2026)

- Lot 1 clos : exactement N + egalite exacte (#205), S2 correlation (#206), Cloud Run redeploye et verifie en reel ; fantasy et score exact ecartes ; prochaine etape = Lot 2 (21/10/2026)
- Popup récap « depuis ta dernière visite » (PR #210 mergée) + fond du classement plus sombre (#209 mergée) ; vérifiée par capture avec données fictives, pas encore avec de vrais résultats (21/10/2026)
- Accueil : carte « Prochain prono » (formulaire /play intégré, surface unique, « À faire aussi », Résultats de la nuit sans compteur), PR ouverte ; recette visuelle à faire (22/10/2026)
- Carte /play + Résultats : zone « Mon pari » (saisie dans la carte), bande Mon prono, popup Les autres (paris en italique), migration bet_is_public poussée (22/10/2026) — PR #216
- Admin rangé en 4 rubriques (À traiter, Jeu, Joueurs, Système) : cartes tiroir, registre lib/admin/navigation.ts, lien retour, animation, Recalculer déplacé ; recette par captures 390/1280 px (22/10/2026)
- Chat : menu ⋯ (Copier/Signaler/Supprimer), réactions emoji à l'appui long (migration poussée), CI dédoublonnée (22/10/2026) — PR #219, #221, #222, #223
- Revue des paris non calculables en prod (23/10/2026) : trou réel = écart orienté sur une période (MARGIN symétrique seulement), noté en GAPS et en tête de REPRISE ; hors-terrain = manuel normal ; paris Rillettes-31 sur compétitions archivées
- État lu/vu lié au compte : chat_read_status + user_seen_state, Realtime, reprise du localStorage (23/10/2026) — PR #230, migrations à pousser après merge ; reste à trier 7 changements non commités
- Chantier Profil & badges : plan (#233), release/profil-badges, Lot Q (PR #234, recette OK 23/10/2026) ; prochain Lot 1
- Chantier Profil & badges : Lot 1 vitrine + lecture groupée (#236, mergé), Lot 2 composants d'identité (#237, ouverte) (24/10/2026) ; D5 couvert par user_seen_state, D7 à trancher
- Chantier Profil & badges : Lot 2 mergé (#237), Lot 4 onglet Badges (#239, recette OK, épingle sur carte) (24/10/2026) ; D7 toujours ouverte ; prochain Lot 5 classement
- Chantier Profil & badges : Lot 5 classement (PlayerIdentity + vitrine dans lignes, barre « Ta place », vue hebdo), PR #241, CI verte, recette visuelle à faire (24/10/2026) ; prochain Lot 3
- Chantier Profil & badges : Lots 3a/3b mergés (#243, #244) ; épingle et vitrine épinglés seulement manquaient dans la release, reportés par #245 (25/10/2026) ; à merger puis recetter
