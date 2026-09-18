# Journal des sessions — NBA Pronos

> **Nature** : vivant — append-only. Chaque nouvelle session ajoute une
> entrée à la fin, les entrées précédentes ne sont jamais réécrites. Le
> détail fichier-par-fichier vit dans `git log` (commits propres depuis la
> session du 16/07/2026) — ce journal se concentre sur les DÉCISIONS et bugs
> marquants, pas la liste exhaustive des fichiers touchés.

> **Compression du 18/09/2026** : ce fichier avait atteint 12 966 lignes
> (250 sessions, texte intégral de chaque session depuis le 16/07/2026),
> devenu impossible à relire d'une traite pour reprendre le projet à froid.
> Réécrit en une ligne de synthèse par session (le titre de chaque section,
> déjà rédigé comme un résumé, est repris tel quel). Le contenu intégral de
> chaque session (contexte, échanges, code, vérifications empiriques) est
> conservé, non modifié, dans
> `archive/JOURNAL_SESSIONS_archive_jusquau_2026-09-18.md`. À partir de
> maintenant, ce fichier redevient append-only comme avant : une nouvelle
> compression n'aura lieu que s'il redevient trop long pour être relu
> rapidement.

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


## Référence

Détail complet de chaque session (contexte, échanges avec l'utilisateur,
code, SQL, vérifications empiriques pas à pas) jusqu'au 18/09/2026 :
`archive/JOURNAL_SESSIONS_archive_jusquau_2026-09-18.md`.
