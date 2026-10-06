# Gaps ouverts — NBA Pronos

> Liste vivante. Un point retiré = un point traité (voir `JOURNAL_SESSIONS.md`
> pour la trace de quand/comment). Ne pas laisser de points "résolus mais
> gardés pour mémoire" ici — c'est le rôle du journal. Restructuré le
> 06/09/2026 : l'historique complet (journal daté 20/07→03/09/2026) a été
> déplacé, intact, dans `Cadrage/Suivi/archive/
> GAPS_OUVERTS_journal_archive_jusquau_2026-09-06.md`.

> **Autre tracker, périmètre distinct** : les gaps issus de l'audit
> sécurité/qualité de septembre 2026 (rate-limiting, tests RLS, focus-trap,
> contraste, responsive desktop, etc.) vivent dans `audit/ANOMALIES.md` et
> `audit/PLAN_ACTION.md` (Vagues 0-4) — pas dupliqués ici, vérifier les deux
> fichiers pour une vue complète des points ouverts.

## Retours de l'alpha (03/10/2026)

> Détail et correspondance avec le code/la feuille de route :
> `RETOURS_ALPHA_NBA_CUP.md`. Priorisés le 03/10/2026 dans la Phase 3 de
> la feuille de route (p3-3 à p3-12, dans l'ordre de traitement).

- **Récaps, suite de p3-10/p3-11 (05/10/2026)** : journalier et hebdo
  livrés (push à 10h + bloc en tête de « Ça vient de tomber »), mais jamais
  vus avec de vraies données : aucune compétition active depuis la clôture
  de l'alpha, et pas de session de test en local. À vérifier à la prochaine
  compétition (y compris un lundi pour le hebdo). Restent : la version « par
  ligue » du hebdo (payante plus tard, Phase 7, à brancher dans
  `canReceiveRecap()`) ; le rapprochement des articles TrashTalk se fait
  par surnom d'équipe dans le titre, heuristique jamais éprouvée en saison
  régulière (en présaison, le flux ne contenait aucun article de résultats).
- **Déjà dans la feuille de route mais reportés, redemandés par les
  testeurs** : photo de profil/avatars (p6-22), landing page (p5-2).
- **Badges, suite de p3-9 (05/10/2026)** : popup et écusson livrés, mais les
  icônes restent celles de la bibliothèque lucide ; les visuels dessinés du
  PDF (vieille dame, chien en laisse, coupe + formulaire, joker...) restent
  à faire (p6-20). La popup est vérifiée aussi juste après un geste du
  joueur depuis le 05/10/2026 ; les badges liés aux résultats (points, bons
  vainqueurs...) restent découverts à l'ouverture ou au retour au premier
  plan, puisqu'ils changent avec la synchro et non avec un geste.
- **Couverture des types de paris** : choisir sa difficulté n'est pas
  intuitif. Couvrir plus de types (modèles ML) et aider au choix.
- **Paris sans joueur identifié, cas restants (suite de p3-14, 05/10/2026)** :
  `resolveNotInMatchBets.ts` couvre désormais les paris JOUEUR simples
  (MATCH et SÉRIE), période joueur et superlatif. Restent à l'admin : un nom
  ambigu sur la feuille (nom de famille seul), et les formes à plusieurs
  joueurs (duel, combo) dont l'id manquerait. L'alerte « Joueur non
  identifié » compte dès l'échéance passée, donc un pari « envoyé quand
  même » y apparaît le temps que le box score soit importé (en général le
  lendemain) -- et, pour un pari SÉRIE, jusqu'à la fin de la série.

## Plan de communication — suite du projet (05/10/2026)

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
  livrée le 07/10/2026. Reste : PR 4/4 (push de 10h groupé avec le récap), **PR 5 (décidée le 07/10/2026 :
  tirage automatique par cron, qui remplace le lancement manuel du script ;
  sert aussi de test de la récupération automatique du calendrier avant la
  Cup et les Playoffs, sans couvrir le mapping A7 de la Cup)**, puis créer la compétition
  DAILY_MATCH en admin et lancer le 1er lot de tirage
  (`node --conditions=react-server --env-file=.env.local scripts/daily-match-draw.mjs --from=... --to=... --dry-run`)
  avant le 20/10. Calendrier Highlightly
  2026-27 incomplet (vide du 10/11 au 27/11 au sondage du 06/10) : tirage par lots.

## Capacité — test de charge

- **Test de charge réel jamais fait** (11/09/2026) — cible théorique connue
  (pooler Supabase local : `default_pool_size=20`, `max_client_conn=100`,
  largement au-dessus des dizaines d'utilisateurs visées par ligue de 10-30
  personnes), mais aucune mesure empirique. Tentative de test local via
  Docker/Supabase CLI abandonnée le jour même : la machine principale (8 Go
  RAM) fait chuter la RAM libre à moins d'1 Go dès le démarrage de Docker
  Desktop (même profil que le BSOD du 07/09/2026) ; la machine de secours
  envisagée a un disque C: saturé (0 Go libre, DISM cassé, nettoyages sans
  effet). Nouveau plan : projet Supabase cloud dédié (`load-test/setup.mjs`
  et `load-test/k6-scenario.js` déjà écrits dans le repo, non commités,
  pointent encore sur `127.0.0.1:54321` — à adapter au projet cloud une fois
  créé). Bloqué sur le quota de 2 projets gratuits Supabase : le projet perso
  "saoulking" doit être mis en pause pour libérer un slot. Reporté après
  l'alpha (voir item P3-1 de la feuille de route).

## e2e / cross-browser

- **WebKit (Safari) mis de côté pour la suite e2e** (p1-2, 07/09/2026) —
  `playwright.config.ts` n'a que `chromium`/`mobile-chrome` (Pixel 7).
  Essayé sur un projet `mobile-safari` (`devices["iPhone 14"]`) : 2 des 3
  specs échouent de façon reproductible (pas des flakes) :
  - **T-UI-01** (focus-trap) : le focus n'est jamais restauré sur le bouton
    déclencheur après `Échap`, contrairement à Chromium — quirk WebKit
    documenté sur la restauration de focus programmatique des `<button>`.
  - **T-UI-02** (connexion → prono → déconnexion) : le flux de validation
    du prono n'aboutit pas (le texte récap "✓ E2H +3" n'apparaît jamais) —
    piste la plus probable : `hasTouch: true` de l'émulation iPhone change
    la sémantique tap/click sur les contrôles `UpcomingRow.tsx`/dialogue de
    validation, jamais testée jusqu'ici.
  - Pas creusé plus loin (décision utilisateur, priorité au viewport mobile
    -- livré et fiable via `mobile-chrome` -- plutôt qu'au moteur Safari).
    À reprendre si Safari/iOS devient un profil de trafic significatif :
    commencer par `components/ui/FocusTrap.tsx` (focus restoration) et le
    dialogue de validation de `UpcomingRow.tsx`/`UpcomingRowForm.tsx`.

## Modèles de probabilité — maintenance

- **Calibration Poisson/normale jamais revérifiée à l'échelle PÉRIODE** —
  `train_player_period_model.py` réutilise `POISSON_STATS` tel quel depuis
  l'échelle match entier ; biais mesuré (sur-estimation) jusqu'à +22% sur
  passes >1 et tirs à 3pts tentés >1 à l'échelle période, alors que les
  stats déjà en Poisson (fg3m/stl/blk/oreb) restent bien calibrées à ce
  grain. Piste : refaire le test empirique Poisson-vs-normale (même
  méthode que `test_overdispersion_ft.py`) spécifiquement à l'échelle
  période pour les 6 stats concernées (pts/reb/ast/fga/fg3a/min).
- **`team_blk.joblib` mal calibré** — écarts jusqu'à +12.3% (le pire point,
  seuil >4), pire que toutes les autres stats équipe du même script (sous
  8% d'écart). Pas un problème d'hyperparamètres (déjà retunés, sans
  effet) : suggère un manque de features utiles (profil défensif adverse,
  taille/mobilité des joueurs sur le terrain), jamais capturées
  actuellement.

## Chantier "paris personnalisés IA" — types encore non calculables

- **+/- joueur par période** mal résolu : `plus_minus` est exclue des 10
  modèles `train_player_period_model.py` et absente de
  `stats_box_scores_by_period` — un pari "+/- en 1ère mi-temps" reste
  structurable côté IA mais se résout toujours à 0. Nécessite un backfill,
  laissé de côté.
- **Paris "cumulé sur la série"** (ex. "Doncic marquera 100+ points sur la
  série") — distinct de "au moins une fois sur la série" (seul cas géré) :
  demanderait une distribution de somme sur un nombre de matchs aléatoire,
  pas construit. Retombe sur validation manuelle admin.
- **Paris SÉRIE sur stat équipe/total** (pas seulement joueur) —
  `resolveCalculableSeriesBets()` filtre encore sur
  `structured_player_id` non-null uniquement (vérifié dans
  `lib/ai/resolveCalculableBets.ts`) ; pièce (a) du chantier "paris série"
  (modèle équipe pour ce scope) jamais construite.
- **Comparer 2 comptages entre équipes** (ex. "Knicks utilisent 3 joueurs de
  plus que les 76ers") et **égalité exacte entre 2 comptages** — différé du
  chantier ROSTER_COUNT, mécanisme distinct à construire.
- **Performance propre d'un joueur sur une période** (ratio, ex. "40% de ses
  points au Q4") et **égalité exacte entre 2 joueurs / sur tout le roster**
  — explicitement laissés de côté du plan de reprise du 24/08/2026, jamais
  repris depuis.
- **"LF suite à des fautes personnelles"** — probablement quasi équivalent à
  la stat FT équipe déjà gérée, jamais vérifié.
- **Décision TTL cache (5 min) / classify-then-structure** reportée faute de
  données de trafic réel (pause actuelle entre alpha et vraie Cup) — à
  revisiter une fois du trafic réel disponible (~20/09/2026).
- **Backtesting du moteur de proba sur de vrais paris résolus** reporté
  après le lancement de l'alpha (trop peu de paris résolus avec
  `calculated_proba` en base pour l'instant).

## NBA Cup — bêta réelle (octobre-novembre 2026)

> Distinct de l'alpha fictive de septembre (automatisée, voir
> `JOURNAL_SESSIONS.md`) : la vraie NBA Cup n'a pas encore de tirage au sort
> officiel connu.

- **Mapping automatique A7** (détection via `/api/sync/schedule` des 4
  matchs de quarts, puis construction des 7 séries internes) jamais
  construit — l'API est match-centrique, jamais série-centrique, règle
  jamais sondée empiriquement. Reporté à la fenêtre Cup réelle (~fin
  octobre 2026) pour sonder avant de concevoir.
- **Garde `bet_scope=SERIES` interdit en NBA Cup** vérifiée seulement par
  relecture de code, jamais exercée en conditions réelles (aucune
  compétition NBA Cup réelle testée à ce jour).
- **Rendu "à pronostiquer" d'un match Cup encore `SCHEDULED`** jamais
  vérifié en conditions réelles — calendrier 2026-27 pas encore publié côté
  Highlightly au dernier sondage.
- **`SYNC_SECRET` exposé en clair plusieurs fois dans le chat** pendant des
  tests (dry-run Cup) — régénération (`.env.local` + secret GitHub Actions,
  synchronisés) recommandée, jamais confirmée faite.

## Chantier juridique — validations professionnelles restantes

> Le reste du cadrage (§2.1-2.11) est fait ; ces points nécessitent une
> validation qu'un agent IA ne peut pas apporter.

- **Base légale précise pour les 15-17 ans** (§8.5,
  `conseils_juridiques_deploiement_application.md`) — nécessite la
  validation d'un professionnel du droit.
- **Logos NBA sans licence** (`public/logos/teams/*.svg`) — risque accepté
  tel quel pour la bêta fermée gratuite actuelle, à revoir obligatoirement
  avant toute ouverture publique/commerciale (2027, 2 options déjà
  identifiées : licence ou remplacement des visuels).
- **Nom de marque "Panier Ballon"** — direction de travail réévaluable,
  pas un choix figé (voir le cadrage business). Le logo, lui, est final
  depuis le 05/10/2026 (wordmark `public/brand/logo-*.svg`).

## Gaps techniques du prototype

- **Performance de `lib/botScripting.ts`** : requêtes Supabase séquentielles
  non batchées — a saturé la mémoire une fois (16 bots, "Avancer de N
  jours" élevé). Jugé hors scope pour un prototype jetable, pas de
  correction prévue sauf gêne concrète.
- **Compte de démo partagé `Demo_Amis`** (bracket/pronos communs à tout le
  groupe de test) — à retirer ou reconvertir en comptes individuels dès que
  l'utilisateur y passe, prévu après la V1. Les dates du jeu de données de
  test (`bracket_deadline`, matchs) sont des timestamps absolus posés au
  seed — à redécaler périodiquement tant qu'un mécanisme relatif à `now()`
  ne les remplace pas.
- **`eslint` bloqué en v9** — `eslint-plugin-react` (via
  `eslint-config-next`) n'a toujours aucune version compatible eslint 10
  déclarée. À revérifier périodiquement.

## Petite dette UI / backlog produit

> Issue de l'audit UX du 16/08/2026 et de sessions ultérieures, jamais
> reprise depuis.

- **Aucun visuel de chargement à la soumission d'un pari personnalisé**
  (demandé par l'utilisateur, 06/09/2026) — `components/bets/BetForm.tsx`
  et `InlineBetForm.tsx` désactivent déjà le bouton pendant `isPending`
  (`useTransition`) mais le libellé reste statique ("Soumettre à
  validation"), aucun spinner ni changement de texte : la requête (appel
  Claude pour structurer le pari, pas instantané) peut donner l'impression
  que rien ne se passe. `components/ui/Spinner.tsx` existe déjà et est
  réutilisable tel quel.
- **Listes déroulantes qui ne passent pas au-dessus du reste de la page**
  (demandé par l'utilisateur, 06/09/2026 -- reproduit sur le Profil) --
  `components/profile/TeamPicker.tsx`/`.module.css` a pourtant déjà
  `position: absolute` + `z-index: 10` sur son `.list` (pensé dès le
  30/07/2026 pour flotter au-dessus, cf. commentaire dans le fichier) :
  le bug est donc un contexte d'empilement d'un ANCÊTRE qui piège ce
  z-index, pas un z-index manquant -- suspect principal, `.photo-page`
  (`app/globals.css`) pose `isolation: isolate` sur toute la page Profil.
  Vérifier aussi `components/chat/ChatNotificationToggle.module.css`
  (`.error`, même patron trigger + `position: absolute`) et refaire un
  grep large (`position: absolute` dans les `.module.css`, pas seulement
  ceux qui ont déjà un `z-index`) pour trouver d'éventuels autres menus
  du même genre encore non recensés.
- **Notifications/popup à la connexion** (résumé depuis la dernière visite,
  badges débloqués, actus) — retenue comme piste produit face à une
  mécanique récurrente, jamais cadrée ni codée.
- **Photo de profil** — validée comme principe côté DA mais explicitement
  "non tranché, à reprendre avant de coder" par le document source : bucket
  Supabase Storage à créer, format/taille, recadrage auto vs. manuel.
- **Ticker "en direct"** (`LiveTicker.tsx`, Jouer/Mes pronos) posé à
  l'essai, pas un chantier figé — décision garder/retirer jamais prise.
- **Composant `Button` partagé** jamais factorisé (19+ déclarations quasi
  identiques) — refactor identifié, pas pressant.
- **`LeaderboardRow` non mémoïsé** ; regroupements de requêtes possibles
  (`getBracket()`, `getHomeData()`).
- **Classes CSS mortes** `.hero-banner-title`/`.hero-banner-subtitle`
  (référencées dans le JSX, aucune règle CSS ne les stylise).
- **Logos de franchise encore en texte seul** sur le feed "Ça vient de
  tomber" (Accueil) et sur le Classement (icônes de résultat à la place,
  jamais de pastille d'équipe).
- **Badges** : badge Grimpeur (progression de rang) reporté par choix
  explicite ; remplacement des icônes stopgap `lucide-react` par des
  visuels IA en pause (3/35 badges pilotés), reprise à date non fixée.
- **Backlog produit jamais repris** : export `.ics`, Hall of shame,
  classement all-time (nécessite un barème de scoring stable dans le
  temps, ou une neutralisation des changements de barème — pas tranché).
- **Taille du logo de la carte-sélecteur d'équipe** — piste évoquée, jamais
  tranchée.
- **3 abonnements Apple dupliqués** sur `Demo_Amis` (Safari iOS recrée un
  abonnement à chaque tentative) — sans conséquence fonctionnelle, pas
  dédupliqué.
