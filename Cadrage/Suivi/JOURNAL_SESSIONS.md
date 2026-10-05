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

## Octobre 2026

- Retrait volontaire du skill `task-observer` (03/10/2026) -- skill Claude Code tiers ("One Skill to Rule Them All", observation des sessions pour proposer des skills) embarqué le 15/09/2026 dans le commit de la carte pronostic (`483b5bb`, PR #92) avec une consigne `CLAUDE.md` de l'invoquer en début de session. Retiré par décision de l'utilisateur : dossier `.claude/skills/task-observer/` supprimé, `CLAUDE.md` ramené à `@AGENTS.md` seul. Aucun impact sur l'application.
- Retours de l'alpha NBA Cup rangés et confrontés à l'avancement (03/10/2026) -- PDF fourni par l'utilisateur déplacé de `Cadrage/` vers `Cadrage/Suivi/RETOURS_ALPHA_NBA_CUP.pdf`, transcrit et mis en regard du code et de la feuille de route dans `RETOURS_ALPHA_NBA_CUP.md` (16 retours : 9 nouveaux, 3 partiels, 4 déjà prévus dont 3 reportés). Section « Retours de l'alpha » ajoutée à `GAPS_OUVERTS.md`. Précision de l'utilisateur : les notifications marchent seulement quand l'app a été ouverte récemment, pas app fermée (piste : urgence push `normal` par défaut). Priorisé avec l'utilisateur et reporté dans la Phase 3 de la feuille de route (p3-3 à p3-12, notifications en tête). Aucun code modifié.
- Notifications app fermée -- urgence push `high` + TTL calé sur l'échéance (03/10/2026, p3-3) -- diagnostic en base prod (lecture seule) : 13 rappels réellement envoyés pendant l'alpha (19→23/09, Apple + FCM), donc la perte se joue côté service push/téléphone, cohérent avec l'urgence `normal` par défaut de web-push ; et seuls 3/9 joueurs actifs avaient activé le push. `lib/push/send.ts` : `urgency: "high"`, TTL par défaut 24h (au lieu de 4 semaines), `ttlUntil()` pour les rappels match/bracket (inutiles après l'échéance), journalisation des échecs non-404/410. En-têtes vérifiés via `generateRequestDetails`. Reste : test réel sur téléphones après merge.
- p3-3 vérifié sur téléphone (03/10/2026) -- après merge de la PR #99, notification reçue sur Android app fermée. Échec sur iPhone expliqué : l'utilisateur a changé de téléphone, le seul abonnement Apple en base (16/09) appartenait à l'ancien iPhone ; préférence PUSH toujours active sur le compte mais aucun abonnement sur le nouveau. p3-3 coché dans la feuille de route ; nouvel item p3-13 ajouté juste après (activation des notifications à la création de compte + cas changement d'appareil), à la demande de l'utilisateur.

- Carte d'activation des notifications sur l'Accueil (04/10/2026, p3-13) -- constat de départ : impossible d'abonner le téléphone pendant l'inscription elle-même (pas de session avant la confirmation de l'email, lien du mail ouvert dans Safari sur iPhone, où le push n'existe pas). Choix validé avec l'utilisateur : carte en haut de l'Accueil uniquement (aussi sans compétition active), 4 cas -- compte jamais en push → « Activer les notifications » ; compte en push mais pas cet appareil → « Activer ici » ; iPhone/iPad hors écran d'accueil → consigne d'installation, sans bouton ; déjà abonné/autorisation bloquée/navigateur incompatible → rien. « Plus tard » = 7 jours par appareil (localStorage). Demande d'autorisation toujours sur un tap, jamais au chargement. `ensurePushSubscribed()` réutilisé tel quel ; son message d'erreur distingue désormais « bloqué » (réglage du téléphone à changer) de « fermé sans choix » -- profite aussi au Profil et au chat. Préférence de notification ajoutée à `getHomeData()`. Aucune migration. tsc/eslint/296 tests OK ; test réel sur téléphones à faire après merge.

- Petites corrections issues de l'alpha (04/10/2026, p3-4) -- 4 retours en une branche. (1) Popups : nouveau `components/ui/Backdrop.tsx`, toucher le fond ferme ; appliqué aux 10 popups (`ModalDialog` et 9 confirmations maison), `OtherBetsModal` et la feuille de `SeriesDrillDown` le faisaient déjà. Double garde : clic sur le fond lui-même (sinon une popup imbriquée, portalée mais remontant l'arbre React, fermerait la popup parente) et appui commencé sur le fond (sinon une sélection de texte relâchée hors de la popup la fermerait). (2) `/play/bracket` : vue en cartes retirée (`BracketFillBoard`, `RoundTabs` supprimés), l'arbre est le seul rendu, « Quitter » ramène à `/play` ; aucune fonction perdue (le pari série existe aussi dans les cartes de l'arbre). `/bracket` (consultation) non touché, voir `GAPS_OUVERTS.md`. (3) Classement : indication au-dessus du tableau, « Touche une ligne pour voir le détail », complétée en portrait (< 768px) par « tourne ton téléphone pour voir toutes les colonnes ». (4) `BracketEntry` : pastille du nombre d'actions en attente, même décompte que la part bracket du compteur de l'onglet Jouer (séries non remplies avant deadline + paris série). Aucune migration. tsc/eslint/296 tests OK ; à vérifier sur téléphone après merge.

- Bracket de consultation `/bracket` réduit à l'arbre (04/10/2026, suite de p3-4) -- en testant après le merge de la PR #102, l'utilisateur retombait sur la vue en cartes : la deadline de l'Alpha NBA Cup étant passée (20/09), `/play/bracket` redirige vers `/bracket`, dont le « Quitter » ouvrait encore la Vue A « résumé par tour ». Validé avec l'utilisateur : arbre seul là aussi. `BracketSummary.tsx` devient l'arbre plein écran ; ce que portait la Vue A remonte dans l'en-tête (chips de ligue, progression, compte à rebours avant deadline). « Quitter » → `/play` pour un joueur, `/leaderboard` pour un visiteur. Supprimés : Vue A de `SeriesDrillDown` (et son prop `view`), `TreeView`, `RoundBanner`, `usePosterToggle`. La redirection après deadline ne porte plus l'ancre `#round-X` (plus de sections par tour) ; les ancres `#series-X` des liens de pari série restent (posées par `NodeCard`). Bug réel trouvé au passage : la barre de `ProgressBar` restait toujours vide (remplissage en `<span>` en ligne, largeur ignorée) -- aussi visible sur les badges du Profil, corrigé par `display: block`. Vérifié visuellement sur `/bracket` en visiteur (serveur de dev, portrait/paysage, feuille de détail). tsc/eslint/296 tests OK.

- p3-13 et p3-4 (y compris `/bracket` en arbre seul) vérifiés sur téléphone par l'utilisateur (04/10/2026) après merge des PR #101, #102 et #103 -- cochés dans la feuille de route, retirés de `GAPS_OUVERTS.md`.

- Retour visuel des actions (04/10/2026, p3-5) -- retours #1 et #13 de l'alpha (« voir que ça charge, puis une confirmation », « animations de validation »). Constat : pari soumis = popup refermée sans un mot, brouillons enregistrés sans aucun signe, prono/« Tout valider »/validation du bracket sans spinner ni confirmation, picks du bracket muets. Approche validée avec l'utilisateur : toast + animation sur la carte. Nouveau `components/ui/Toast.tsx` (`ToastProvider` monté dans `app/(app)/layout.tsx`, `useToast()` sans effet hors de la zone joueur ; un toast à la fois, 2,6 s, région `role="status"` toujours montée pour les lecteurs d'écran ; succès uniquement, les erreurs restent en ligne). Nouveau `lib/hooks/useSuccessFlash.ts` + `components/ui/SuccessFlash.module.css` (éclat vert avec rebond, variante `.glow` sans `scale()` pour les cartes de l'arbre -- `TreeConnectors` mesure leurs positions -- et coche « ✓ Enregistré »). Branché sur : prono (spinner « Enregistrement… »/« Validation… », toast, éclat de la carte), « Tout valider » (toast « N pronos validés »), pari perso et pari série (`InlineBetForm`, `BetForm` : libellé d'attente « Analyse du pari… » au lieu de « Envoi… » puisque la soumission attend la structuration IA, toasts brouillon/envoi/retour en brouillon, éclat du bouton pari une fois la popup refermée), suppression de pari, picks du bracket (halo + coche, pas de toast), validation et remise à zéro du bracket. `prefers-reduced-motion` : contour fixe au lieu des animations. Aucune migration. tsc/eslint/296 tests OK ; pas de vérification visuelle en session connectée (écrans réservés aux joueurs), à vérifier sur téléphone après merge.

- Préparation de la clôture de l'Alpha NBA Cup -- 4 paris jamais résolus (04/10/2026) -- état vérifié en base prod (lecture seule) avant d'archiver : 7/7 séries terminées, 7 matchs `FINISHED`, aucune demande de correction, mais 4 paris encore `VALIDATED` dont 2 de Rillettes-31, 2e à 1 point de Leopoldinho. Ce n'est pas une panne du resolver. Brunson : pari posé sur LAL–GSW, `structured_player_id` vide, donc jamais examiné par `resolveCalculableBets()`. Tatum : absent de la feuille du vrai match emprunté (`0022500320`, blessé), donc pas de ligne `stats_box_scores` et le resolver refuse de trancher. Les 2 paris de Nico n'étaient pas calculables (résolution manuelle prévue). Stats réelles relevées pour les trancher : 2 double-doubles seulement (Tatum, LeBron) ; MIL gagne Q1 et Q4 (`stats_box_scores_by_period`, totaux recoupés avec 117–109). Aucun choix ne change le classement en tête. Les deux trous sont ajoutés à `GAPS_OUVERTS.md` et à la feuille de route (p3-14, p3-15). Restent : trancher les 4 paris en admin, clôturer, retirer l'automatisation alpha. Aucun code modifié.

- Clôture de l'Alpha NBA Cup + retrait de son automatisation (04/10/2026) -- avant la clôture, 49 captures d'écran prises sur la prod en vue iPhone (classement et détail par joueur, arbre du bracket et fiche des 7 séries, pages publiques des 9 joueurs, Accueil/Jouer/Résultats/Profil/Chat en session connectée, pronos et paris des autres par match ; pas d'admin) comme trace de l'alpha et matière pour du motion design Instagram. Gardées hors du repo à la demande de l'utilisateur (66 Mo), dans son OneDrive. Connexion impossible dans un navigateur piloté par Playwright (Turnstile le bloque) : contourné en lançant Chrome avec un port de débogage et un profil temporaire, l'utilisateur s'y connecte, capture via CDP, profil effacé ensuite. L'utilisateur a tranché les 4 paris en admin puis clôturé la compétition. Retirés : `.github/workflows/nba-cup-alpha-reveal.yml` (cron 30 min), `app/api/nba-cup-alpha/auto-reveal/`, `lib/nbaCupAlpha/` (`autoReveal.ts`, `autoCreateNextRound.ts`) ; commentaires de `lib/ai/resolveCalculableBets.ts` mis à jour (`resolveAllCalculableBets()` reste utilisé par `/api/resolve-bets`). Scripts manuels `scripts/nba-cup-*.mjs` conservés. Statut de clôture pas revérifié en base (lecture prod refusée par le mode auto de la session).

- Popup « Pari validé » (04/10/2026) -- demande de l'utilisateur après p3-5 : le toast passait trop inaperçu au moment d'une validation, il voulait voir le pari validé en popup. Choix de l'utilisateur : popup dans les deux cas (validation par le joueur ET par un admin), fermée par un bouton « OK » plutôt qu'automatiquement. Nouveau `components/ui/ValidatedDialog.tsx` (`ValidatedDialogProvider` dans `app/(app)/layout.tsx`, `useValidatedDialog()`, file d'attente si plusieurs arrivent ensemble ; coche animée, titre, rappel, `role="alertdialog"`). Remplace le toast pour : prono validé (`UpcomingRow`, rappel « LAL bat BOS de 7 pts » via `lib/labels/pronos.ts`), « Tout valider » (liste des pronos réellement validés, la page passe le rappel de chaque match au bandeau), pari perso auto-validé par l'IA (`submitBet` relit le statut après structuration et renvoie `autoValidated` ; sinon toast « envoyé à validation » inchangé). Validation admin : `getRecentAdminValidatedBets()` (`lib/queries/bets.ts`, paris `VALIDATED` avec `validated_by_admin_id` non nul, 14 derniers jours) lu par la coquille, `components/bets/ValidatedBetsWatcher.tsx` compare à la clé localStorage `validated-bets-seen-at` (premier passage : clé posée sans popup, pour ne pas déverser l'historique). Visible au prochain chargement complet ou après une action du joueur qui revalide la coquille, pas en direct. Bracket non concerné (pas un pari). e2e `t-ui-02` adapté (vérifie la popup puis « OK ») mais non relancé (Docker). Aucune migration. tsc/eslint/296 tests/build OK ; pas de vérification visuelle en session connectée, à vérifier sur téléphone après merge.

- p3-5 vérifié sur téléphone + règle du joueur qui ne joue pas (04/10/2026, p3-15) -- l'utilisateur confirme p3-5 et la popup « Pari validé » sur téléphone : p3-5 coché dans la feuille de route, retiré de `GAPS_OUVERTS.md`. p3-15 : `stats_box_scores` ne contient que les joueurs qui ont joué, donc un box score importé sans ligne pour le joueur visé prouve un DNP ; jusqu'ici chaque resolver lisait ça comme « pas encore synchronisé » et le pari restait `VALIDATED` pour toujours (Tatum, alpha). Règle tranchée par l'utilisateur : **LOST**, quel que soit le sens du pari (préféré à CANCELLED et à « selon OVER/UNDER »), sur **tous** les paris qui nomment un joueur. Nouveau `isBoxScoreSynced()` + `DNP_RESOLUTION_REASON` (`lib/ai/resolveBetsShared.ts`, aussi repris par `resolveRosterCountBets`). Appliqué à : un seul joueur (`resolveMatchBets`) ; période (DNP sur le match → LOST ; a joué le match mais pas ces quarts-temps → stats à 0 sur la période dès que les stats par période du match sont là, avant c'était aussi bloqué pour toujours) ; série (match où il n'a pas joué = pas de hit, le reste de la série décide) ; combo (condition fausse, y compris une somme sur plusieurs joueurs dont un absent, qui comptait auparavant silencieusement pour 0) ; duel (GT/DIFF_LT perdus, en « OU » seul le côté absent échoue). `BLOCK_ON_PLAYER` et superlatifs tranchaient déjà (aucun contre / valeur 0). Phrase ajoutée sur `/regles` (« si un joueur visé ne joue pas, le pari est perdu »). 11 tests ajoutés/adaptés ; tsc/eslint/307 tests OK. Aucune migration.

- Joueur absent du match (04/10/2026, p3-14) -- PR #108 (p3-15) mergée, p3-15 cochée dans la feuille de route. p3-14 : jusqu'ici, un pari sur un joueur que l'IA juge hors des deux équipes (`not_in_match`) était auto-validé à 0 % sans `structured_player_id`, aucun resolver ne le prenait, et le joueur ne pouvait plus le supprimer (`delete_bet` = DRAFT/SUBMITTED). Choix de l'utilisateur : faire confirmer plutôt que bloquer (l'IA peut se tromper : roster incomplet, transfert récent), et traiter les 3 volets dans la même PR. (1) Soumission : `structureAndScoreBet()` renvoie `{ playerNotInMatch }` sans rien écrire, `submitBet()` repasse le pari en brouillon (`withdraw_bet`) et le renvoie ; `PlayerNotInMatchConfirm` (partagé par `InlineBetForm` et `BetForm`) remplace les boutons : « Corriger le pari » ou « Envoyer quand même » (renvoi avec `confirmPlayerNotInMatch`, comportement d'avant). L'id du brouillon est gardé côté client pour ne pas créer un 2e pari. (2) Résolution : `lib/ai/resolveNotInMatchBets.ts` (15e resolver) cherche le joueur par son nom normalisé (accents, ponctuation, Jr./III ignorés) sur la feuille du match terminé : absent → LOST (motif dédié), nom complet présent → résolu sur ses vraies stats + id renseigné, nom de famille seul → laissé à l'admin. Paris JOUEUR simples de scope MATCH uniquement. (3) Admin : badge « Joueur non identifié » dans la file de résolution, alerte sur le tableau de bord (`isUnidentifiedPlayerBet()`). 8 tests ajoutés ; tsc/eslint/315 tests OK. Aucune migration. Pas de vérification visuelle en session connectée, à vérifier sur téléphone après merge (pari « Brunson +15 pts » sur un match sans les Knicks).

- Popup des autres joueurs dans Résultats (04/10/2026, p3-6) -- PR #109 (p3-14) mergée, vérifiée sur téléphone par l'utilisateur, p3-14 cochée dans la feuille de route. p3-6 (retours alpha #12 et #15) : dans `LockedRow`, le panneau dépliable des pronos des autres (`RevealPanelLocked`) et le bouton séparé des paris (`OtherBetsModal`) sont fusionnés derrière un seul bouton « Pronos et paris des autres (N) », qui ouvre une `ModalDialog` en deux sections (nouveau `components/play/OthersOnMatch.tsx`, les deux anciens composants supprimés). Chaque pari des autres montre désormais son statut (même pastille que `BetBlock`, exportée en `BetStatusPill`), « +N pts » s'il est gagné, « N pts en jeu » / « valait N pts » sinon (`possiblePointsLabel()`, barème `BET_DIFFICULTY_POINTS`) et la proba calculée pour un pari calculable. `OtherBet` (`lib/queries/play.ts`) porte statut, difficulté, points et proba, déjà lus par la requête (RLS `bet_is_public()` inchangée). Le pari du joueur affiche aussi les points en jeu. Interprétation retenue pour « % et points possibles » : proba calculée + points du palier, pour tous les paris (pas seulement les gagnés). Aucune migration. tsc/eslint/315 tests OK. Pas de vérification visuelle : aucune compétition active depuis la clôture de l'alpha, l'onglet Résultats est vide en prod.

- Messages de chat non lus (04/10/2026, p3-7) -- PR #110 (p3-6) mergée et vérifiée sur téléphone par l'utilisateur, p3-6 cochée dans la feuille de route. p3-7 (retour alpha : pastilles de non-lus sur les conversations) : aucune notion de « lu » n'existait. Même choix que la pastille « nouveaux résultats » de l'Accueil : état « lu » par appareil en localStorage, aucune migration. Serveur : `getRecentChatActivity()` (`lib/queries/chat.ts`) renvoie canal + date des messages des AUTRES joueurs des 14 derniers jours (RLS `chat_messages_select` limite déjà aux canaux du joueur ; fenêtre pour qu'un nouvel appareil n'affiche pas tout l'historique), ajouté à `getNavBadgeData()` -- désormais lu aussi sans compétition active (avant, la fonction sortait tôt). Client : `lib/nav/chatSeen.ts` (clé `chat-seen-at`, dernier message vu par canal, `markChatChannelSeen()` + `useUnreadChatCounts()` via `useSyncExternalStore` abonné à un évènement maison et à `storage`, pour que la TabBar s'éteigne dès qu'un canal est ouvert). Affichage : nombre sur l'onglet Chat (somme des canaux, plafonné « 9+ ») et sur chaque ligne de la liste des canaux (`ChatUnreadBadge`, liste relue par `/chat` à chaque visite) ; `ChatSubscriber` marque le canal lu jusqu'au dernier message affiché, y compris ceux reçus en direct. Limite connue : pas de mise à jour en direct de la pastille de l'onglet hors du chat (comme les autres pastilles, rechargement ou action serveur). 5 tests ajoutés ; tsc/eslint/320 tests/build OK. Pas de vérification visuelle (écran réservé aux joueurs connectés), à vérifier sur téléphone après merge.

- Bandeau du prono façon télé (05/10/2026, p3-8) -- PR #111 (p3-7) mergée et vérifiée sur téléphone par l'utilisateur, p3-7 cochée dans la feuille de route. p3-8 (retour alpha #5 : bandeau « BOS +3 » « moins rond, plus arena ») : l'utilisateur voulait un rendu « bandeau télévisé avec biseau » (exemple fourni : `Cadrage/DA/Bandeau exemple.webp`). 3 variantes maquettées dans un artifact (bandeau d'info orange, même bandeau en couleur d'équipe, scorebug compact) ; choix d'abord du scorebug compact en couleur d'équipe (1re version de la PR), puis retour de l'utilisateur sur **le bandeau d'info en couleur d'équipe, sans logo dans le bloc « Mon prono »** (doublon avec l'en-tête de la carte). Nouveau `components/play/PronoBug.tsx` : bloc sombre « Mon prono », coupe en biseau, bande « BOS +3 » au dégradé de la couleur d'équipe (reflet, hachures, filet clair), sous-bandeau optionnel (détail à gauche, total à droite) ; bande neutre « Pas de prono » / « Brouillon incomplet » sinon ; `role="group"` + libellé « Mon prono : BOS +3 ». Utilisé par `PredictionSummary` (cartes verrouillées : Mes pronos en cours et Résultats -- détail des points dans le sous-bandeau, « En attente du résultat » tant que non scoré) et, à la demande de l'utilisateur en cours de session, par `UpcomingRow` sur « Mes pronos » (bandeau pleine largeur au-dessus de la rangée méta, à la place de la pilule « ✓ BOS +3pts d'écart » d'un prono validé ; « 1 pari perso verrouillé » dans le sous-bandeau). Couleurs d'équipe sorties du seul Profil avec l'accord explicite de l'utilisateur : `broadcastBandColor()` (`lib/labels/teamColors.ts`, primaire, secondaire si trop claire pour du blanc -- SAS ; repli accent pour une équipe inconnue). Tokens `--color-broadcast-*` (`app/tokens.css`) volontairement non redéfinis en clair : l'incrustation reste sombre sur les deux thèmes. e2e `t-ui-02` adapté (cherche le bandeau par son libellé) mais non relancé (Docker). 4 tests ajoutés (dont contraste du blanc >= 3 sur les 30 équipes) ; tsc/eslint/324 tests/build OK. Aucune migration. Pas de vérification visuelle en session connectée, à vérifier sur téléphone après merge.
- Badges : écusson + popup « nouveau badge » (05/10/2026, p3-9) -- PR #113 (option B du bandeau, p3-8) mergée, confirmée sur téléphone par l'utilisateur, p3-8 cochée dans la feuille de route. p3-9 (retour alpha #9 : popup à l'ouverture quand un badge a été gagné + retravailler le design) : 3 styles maquettés dans un artifact Design (médaille, écusson, plaque arena) + une variante « planche de panneau de basket » demandée par l'utilisateur puis écartée ; choix : écusson (B). Icônes revues selon `Cadrage/DA/BADGES.pdf` quand lucide a l'équivalent (chien, bombe, cavalier, podium...), centres sur-mesure pour Buzzer-beater « 0.0 », Money-time « 0:03 », Buzzer-beater série « 4-2 », Métronome/Fidèle (record). Popup : `NewBadgesWatcher` monté dans la coquille, charge les badges via la server action `getUnlockedBadges` après l'affichage (pas dans le layout, vues à vie coûteuses), compare au palier déjà montré par appareil (localStorage par compte) ; premier passage = tous les badges déjà gagnés défilent (choix de l'utilisateur) avec « Tout passer ». Re-vérifié au retour au premier plan, au plus toutes les 5 min. Tests unitaires `lib/badges/display.test.ts`. Pas vérifiable visuellement en local (pas de session de test) : à vérifier sur téléphone après merge.
- Popup « nouveau badge » juste après un geste (05/10/2026, gap ouvert de p3-9) -- PR #114 (p3-9) mergée et vérifiée par l'utilisateur sur téléphone et navigateur, p3-9 cochée dans la feuille de route (avec p6-18 et p6-21, couverts par elle) ; correctif e2e de la popup (PR #115) mergé. Gap choisi par l'utilisateur : la popup n'était vérifiée qu'à l'ouverture et au retour au premier plan. Les badges étant calculés par une vue ordinaire (`user_badges_lifetime`, pas matérialisée), ceux qui dépendent d'un geste changent dès l'écriture : Machine à pronos (prono non brouillon), Accro du pari / Maïno / échelle de difficulté (pari envoyé), Avant-gardiste (bracket validé), Sociable (ligue). Nouveau `lib/badges/checkRequest.ts` : évènement client `requestBadgeCheck()` émis après succès par `UpcomingRow` (validation d'un prono), `ValidateAllBanner`, `BetForm`, `InlineBetForm`, `FillPosterView` (bracket) et, pour les ligues (action serveur à redirection), par `BadgeCheckOnMount` sur la page Profil quand `leagueJoined`/`newLeagueName` est présent. `NewBadgesWatcher` l'écoute (vérification 600 ms après, sans la limite des 5 min ; une demande pendant une lecture en cours relance une lecture à la fin) et n'affiche plus sa popup tant que la popup « Pari validé » est ouverte (`useIsValidatedDialogOpen()`, `components/ui/ValidatedDialog.tsx`) -- corrige au passage l'empilement possible à l'ouverture avec `ValidatedBetsWatcher`. Les badges de résultats restent découverts à l'ouverture (ils changent avec la synchro). 2 tests ajoutés ; tsc/eslint/332 tests/build OK. Aucune migration. À vérifier sur téléphone après merge.
- Paris sans joueur identifié, au-delà du cas simple (05/10/2026, gap ouvert de p3-14) -- Travail commencé sur une branche partie de `main` pendant que la PR #116 (popup badge après un geste) était encore ouverte ; #116 mergée depuis, conflit du journal résolu. `resolveNotInMatchBets.ts` ne traitait que les paris JOUEUR simples de scope MATCH ; un pari SÉRIE « envoyé quand même » sur un joueur hors série, ou un pari période joueur / superlatif dont le micro-service n'avait pas renvoyé d'id, restait `VALIDATED` pour toujours. Constat en lisant le code : un pari période sans id a aussi `structured_period.player_id` nul, donc `resolvePeriodBets` le prenait pour un pari ÉQUIPE et le sautait (`outcome_kind manquant`) ; le dernier panier n'est pas concerné (`predictLastBasket()` renvoie toujours un id). Mêmes règles que p3-14/p3-15 : période/superlatif -> recherche par nom sur la feuille du match, absent -> LOST, trouvé -> id renseigné (aussi dans `structured_period`) et le resolver de la famille tranche à la passe suivante, nom ambigu -> admin. SÉRIE -> recherche sur chaque match terminé de la série : trouvé -> id renseigné (`resolveSeriesBets` prend le relais), absent de toutes les feuilles d'une série terminée et entièrement importée -> LOST (nouveau motif `NOT_IN_SERIES_RESOLUTION_REASON`), sinon attente. Restent à l'admin : nom ambigu, duel/combo sans id. 8 tests ajoutés/adaptés ; tsc/eslint/337 tests OK. Aucune migration.
- Récaps du matin, journalier et hebdo + débrief des matchs (05/10/2026, p3-10 + p3-11) -- PR #117 (paris sans joueur identifié, au-delà du cas simple) mergée. Point 4 choisi par l'utilisateur (récaps d'abord, avant les modèles ML), puis contenu cadré avec lui avant tout code : récap fusionné dans « Ça vient de tomber » sur l'Accueil plutôt qu'un écran dédié ; « Ta nuit » (toi : points, détail, rang et évolution, joueurs dépassés ; la compet' : meilleure nuit, plus gros pari réussi ; scores de la nuit), « Ta semaine » le lundi (classement de la semaine top 3 + ta place, plus grosse remontée, sniper, pari de la semaine, et « le plus loufoque perdu » -- ajout de l'utilisateur, défini comme le pari perdu de plus haute difficulté puis de plus faible proba) ; push à 10h Paris, hebdo à la place du journalier le lundi, jamais de push vide ; activé par défaut + interrupteur dans le Profil ; tout gratuit mais derrière une fonction d'accès unique pour la bascule payante. p3-11 groupé ici à sa demande : média choisi TrashTalk ; flux RSS seul exploitable (pas de catégories ni de recherche), donc article rapproché par surnom d'équipe dans le titre, repli sur la page d'accueil. Constat technique : `scored_at` est réécrit à chaque recalcul du barème (et pour les picks du bracket à chaque match de la série), donc les points gagnés sont calculés par différence avec le dernier snapshot quotidien du classement, pas par date de score. Nouveau `lib/recaps/` (`period.ts` fenêtres, `build.ts` contenu pur, `load.ts` lecture, `text.ts` textes, `trashtalk.ts`/`trashtalkFeed.ts`, `home.ts`, `sendRecaps.ts`, `access.ts`), route `/api/recaps` + workflow `recaps.yml` (8h et 9h UTC, rien avant 10h Paris, `recap_log` dédoublonne), `RecapBlock` sur l'Accueil, `CollapsibleCard` ouvrable par ancre (`/home#recap`). Migration `20261005090000_recaps.sql` : `users.recap_enabled` (défaut vrai) + table `recap_log` (RLS sans policy). 22 tests ajoutés ; tsc/eslint/361 tests/build OK. Pas de vérification visuelle : aucune compétition active. Migration à pousser (`npx supabase db push`) après le merge.

- Plan de communication recalé, étape A (05/10/2026) -- Relecture du cadrage business/communication (écrit avant l'alpha) face à l'état réel : alpha à 4 comptes classés pour une cible de 10-20, aucune compétition active, rien de fait du socle SEO prévu pour octobre (mot « paris » encore en production, pas de page publique, pas de `sitemap.ts`/`robots.ts`, pas de Discord). Quatre étapes décidées dans cet ordre : A recaler, C socle SEO/vocabulaire (code), B contenu Instagram, D recrutement ; notées dans `GAPS_OUVERTS.md`. Question de l'utilisateur : jouer dès la phase de groupes de la NBA Cup ? Vérifié dans le code (explorer) : non, `matches.series_id` obligatoire, enum des tours éliminatoires seulement, création de Cup = arbre fixe, 4-6 jours estimés ; une piste « série à un match » existe mais n'a pas été sondée. Décision : bêta sur la phase finale, 4→11/12/2026, canaux en parallèle dans 2-5 h/semaine. Nouveau `Cadrage/Business/panier_ballon_plan_recale_octobre_decembre.md` (objectifs, calendrier semaine par semaine, points ouverts dont « que jouent les inscrits avant le 4/12 »). Aucun code modifié.

- Plan de communication, étape B : carrousel « Bilan de l'alpha » (05/10/2026) -- Choix de l'utilisateur : un post qui explique les retours reçus (pas de démo des nouvelles fonctionnalités, réservées à du motion design ultérieur : présentation générale de l'app puis motions par fonctionnalité) ; le mot « paris » est conservé ; podium anonyme (compétition test). Chiffres lus en base prod en lecture seule (aucune écriture) : alpha archivée le 04/10, 280 points au total (bracket 185 + pronos de match 55 + paris 40), 4 joueurs classés (110/109/36/25, un 5e compte à 0), 7 séries, 18 picks de bracket, 8 pronos de match, 7 paris dont 2 gagnés. 6 slides générées à partir des gabarits existants (`post-gabarit`, `post-contenu`, `post-conclusion-gabarit`, seuls les blocs de texte remplacés) par un script jetable ; rendues avec les vraies polices, marges ≥ 96 px. Relecture `reviewer` : a corrigé une formulation périmée (la slide disait « on cherche comment rendre les rappels fiables » alors que p3-3 est livré et vérifié sur Android), apostrophes courbes et espaces insécables. Fichiers dans `Cadrage/DA/instagram/Posts/Post 5/` (SVG + PNG + `legende.md`). Non commité, aucune publication. Aucun code applicatif modifié.
- Plan de communication, étape C : socle SEO et vocabulaire (05/10/2026) -- Branche `feat/seo-socle` (partie de `main`, PR à ouvrir). Cartographie (explorer) puis plan (architect, docs Next 16 lues). Décision de l'utilisateur en fin de session, qui renverse l'objectif initial « 0 occurrence de paris » : le mot est conservé volontairement dans les métadonnées et sur `/` pour être trouvable sur « pari » (le sens est clair : aucun argent réel), toujours accompagné de « sans argent réel » vu le point de vigilance ANJ du cadrage ; `lib/seo.test.ts` vérifie maintenant sa présence ET celle de « argent réel ». Autres décisions : indexer `/leaderboard` et `/bracket` (pseudos publics, donc phrase ajoutée à `/confidentialite`), `/regles` traitée au niveau métadonnées seulement, pas d'image OG 1200×630 (nouveau logo en préparation) -> icône carrée provisoire. Nouveau `lib/seo.ts` (nécessaire car Next fusionne les métadonnées de façon superficielle), page `/` publique (`app/(public)/page.tsx`, remplace la redirection vers `/login`), `/` ajouté aux pages réservées aux visiteurs dans `proxy.ts` (+ matcher excluant robots/sitemap/manifest), `robots.ts`, `sitemap.ts`, `metadata` sur toutes les pages publiques. Revue `reviewer` : `/chat`, `/mfa-*` ajoutés au Disallow, cibles tactiles des liens, tests renforcés (6). tsc/eslint/342 tests/build OK. Non vérifié : rendu visuel de `/`, pages publiques en visiteur anonyme. Demandé aussi : tout motion/vidéo de présentation de l'app exige d'abord un cadrage très précis. Aucune migration.
- Nouveau logo intégré (05/10/2026) -- Branche `feat/nouveau-logo` (partie de `main`). Le logo final (`Cadrage/DA/Logo final/`, wordmark « Panier Ballon » horizontal + empilé) remplace l'ancien badge panier/ballon : `public/brand/logo-{horizontal,carre}.svg` (ancien `logo.svg` supprimé), nav visiteur + accueil + connexion/inscription/reset (le texte « Panier Ballon » redondant retiré, alt sur l'image), favicon, apple-icon et icônes PWA régénérés (logo carré centré sur fond #0B0E14). Gabarits Instagram (`Cadrage/DA/instagram/`, hors git) : en-tête badge+texte remplacé par le logo horizontal sur posts/stories/Post 1-5, `profil.svg` et `logo-filigrane.svg` refaits avec le logo carré ; `Posts/Post 4/Old/` laissé tel quel (archives). Reste : image OG 1200×630 (voir GAPS).

## Référence

Détail complet de chaque session (contexte, échanges avec l'utilisateur,
code, SQL, vérifications empiriques pas à pas) jusqu'au 18/09/2026 :
`archive/JOURNAL_SESSIONS_archive_jusquau_2026-09-18.md`.
