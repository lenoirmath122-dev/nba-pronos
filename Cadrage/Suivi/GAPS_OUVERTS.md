# Gaps ouverts — NBA Pronos

> **Nature** : vivant. Seulement ce qui reste OUVERT. Un point traité est
> **retiré** (sa trace va dans `JOURNAL_SESSIONS.md`), jamais barré ni
> annoté « fait ». Les gros chantiers ont leur détail dans `chantiers/` ;
> ici, un résumé de quelques lignes chacun. Version complète avant le
> nettoyage du 12/10/2026 : `archive/GAPS_OUVERTS_archive_jusquau_2026-10-12.md`.

> **Autre tracker, périmètre distinct** : les gaps issus de l'audit
> sécurité/qualité de septembre 2026 vivent dans `audit/ANOMALIES.md` et
> `audit/PLAN_ACTION.md` — vérifier les deux pour une vue complète.


## Chantiers en cours — résumé (détail dans `chantiers/`)

> Chaque chantier a son fichier détaillé, à n'ouvrir que si la session porte
> dessus. Ici : seulement ce qui reste ouvert et la prochaine étape.

### Enrichissement des modèles / types de paris — [`chantiers/CHANTIER_ENRICHISSEMENT_MODELES.md`](chantiers/CHANTIER_ENRICHISSEMENT_MODELES.md)
Cadrage : `Cadrage/Fonctionnel/nba_pronos_cadrage_enrichissement_modeles_paris.md` (scénario A).
- **Correctif Memphis mergé (#192, 20/10/2026)**. Reste : rejouer le pari `f4f3ebd6…` après
  déploiement (coût d'un appel IA, demander d'abord).
- **Seuils inclusifs corrigés (#195, 20/10/2026)** : « N ou plus » / « au moins N » étaient
  encodés `OVER N` alors que le calcul est strict. `inclusiveThreshold.ts` convertit en code
  (enum `AT_LEAST`/`AT_MOST` dans `structureBet`, booléen `inclusive` ailleurs). Vérifié par appels
  réels. Reste : « Hauser ou Pritchard » (COMPARISON/OR) non vérifié ; rejouer d'anciens paris ?
- Puis reste du **Lot 1** (S1, S2, S4, S3, S8…) avant la bêta Cup du 04/12 ;
  Lots 2 à 4 ensuite (déc. → mars).
- **À part, conversation dédiée** : instabilité des probas (3 valeurs pour 20
  appels identiques, avec ou sans cache).
- Après le plan A : outil admin pour les paris non calculables (non cadré).

### Communication et Match du jour — [`chantiers/CHANTIER_COMMUNICATION.md`](chantiers/CHANTIER_COMMUNICATION.md)
- Étapes A et C faites. **B (Instagram)** : publier le Reel R1 v3 et le Reel
  de clôture du test (`DA/instagram/Réels/…cloture-test-reel-v3.mp4`, + Story
  de repost), suite du calendrier oct.-nov. **D (recrutement)** : mode d'emploi d'inscription,
  tableau de suivi, message aux ambassadeurs, exécution du calendrier.
- **Match du jour** : publié depuis le 16/10, tirage en cron Vercel (PR #178 à
  #181 mergées). À surveiller : horizon de synchro de 4 jours (création auto des
  matchs à ≥ 4 jours à vérifier), quota Highlightly, Thanksgiving.
- **Conversion pub Instagram** (PR #177 mergée le 15/10, captcha retiré) :
  vérifier que le captcha est bien désactivé côté Supabase (Auth > Attack
  Protection). Restent : compteur d'inscrits et captures sur la landing (p5-2),
  UTM sur les liens de pub, surveillance des faux comptes sans captcha.
- **Pseudo modifiable + onboarding** (PR #176 mergée le 12/10, changement de
  pseudo avec validation admin inclus) : reste à valider sur de vrais téléphones
  (Android Chrome, iPhone Safari, iPhone installé).

### Données NBA (crons, résultats, box scores) — [`chantiers/CHANTIER_DONNEES_NBA.md`](chantiers/CHANTIER_DONNEES_NBA.md)
- Crons passés sur Vercel : récap, tirage du match du jour, rappel du match
  du soir, `heartbeat`, `snapshot-leaderboard`, `reminder-bracket` (20/10/2026,
  workflows GitHub supprimés ; plus d'issue `cron-failure` automatique pour
  ces trois-là). Les autres workflows planifiés (`sync-*`, watchdogs,
  health-check) n'ont pas été réexaminés.
- Poller des résultats sur la VM : PR C mergée (#149) ; à confirmer : VM à
  jour, 2 soirs en dryRun, passage en réel, puis activer le watchdog.
- Import des box scores sur la VM : observer une semaine à la reprise,
  vérifier la facturation IPv4, la correspondance des tricodes.
- Idée non décidée : remplacer Highlightly par la VM + l'API NBA.

### Accueil jouable et pronos invités — [`chantiers/CHANTIER_ACCUEIL_INVITES.md`](chantiers/CHANTIER_ACCUEIL_INVITES.md)
- Phase 1A livrée (PR #184 et #188 mergées le 19/10) : accueil jouable, pronos
  invités `PENDING`, mesure de l'entonnoir.
- **1B e-mails** livrée (PR #185 à #187 mergées le 19/10, migration `email_log`
  appliquée, Resend en place). **Reste** : essai réel (dry-run puis envoi) et
  recette Gmail/Outlook/iCloud, spam, désinscription, 1 relance, ≤ 1 mail/jour.
  Deux flags coexistent : `recap_enabled` (push) et `email_results_enabled` (mail).
- Refonte UI/UX : à refaire de zéro plus tard (branche locale `refonte-ux`
  non poussée, à supprimer).

### Classement hebdo et popup LLM — [`chantiers/CHANTIER_CLASSEMENT_HEBDO.md`](chantiers/CHANTIER_CLASSEMENT_HEBDO.md)
- Lots 0 à 4 codés (vérifier que les PR des lots 2 et 4 sont mergées).
- **Lot 5, popup LLM** : codé de bout en bout (PR 3, 4 et 5 mergées : #170,
  #172, #171). Points ouverts après la PR 3 listés dans le fichier.
- À faire par l'utilisateur : activer `weekly_ranking` (puis `weekly_popup`)
  sur la compétition réelle ; vérifier que Vercel autorise 3 crons ;
  contrôler le premier figement du **lundi 26/10**.

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
- **Paris sans joueur identifié, cas restants (suite de p3-14, 05/10/2026)** :
  `resolveNotInMatchBets.ts` couvre désormais les paris JOUEUR simples
  (MATCH et SÉRIE), période joueur et superlatif. Restent à l'admin : un nom
  ambigu sur la feuille (nom de famille seul), et les formes à plusieurs
  joueurs (duel, combo) dont l'id manquerait. L'alerte « Joueur non
  identifié » compte dès l'échéance passée, donc un pari « envoyé quand
  même » y apparaît le temps que le box score soit importé (en général le
  lendemain) -- et, pour un pari SÉRIE, jusqu'à la fin de la série.

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

- **Paris « le joueur joue seulement N quarts-temps »** (ex. « Shai joue
  seulement 3 quart temps », constaté le 06/10/2026, pari `7db72374…`
  resté `is_calculable=false`, en validation manuelle). Cause vérifiée :
  `PERIOD_KEYWORD_REGEX` (`lib/ai/structureAndScoreBet.ts`) matche « quart
  temps » et route vers `handlePeriodBet`, qui attend une stat joueur
  limitée à une période (ou un résultat de période), pas un temps de jeu :
  `markNotCalculable()`, sans repli. Besoin décidé par l'utilisateur : en
  faire un type de pari avec son propre modèle à entraîner, pris en compte
  dans le calcul. Pas commencé. Pistes à instruire : définir « a joué un
  quart » (minutes > 0 par période ?), vérifier que
  `stats_box_scores_by_period` permet de le dériver, nouveau routage avant
  le filtre période, nouveau modèle dans `stats-service`, résolution
  automatique WON/LOST. En attendant, une formulation en minutes
  (« joue moins de N minutes ») est déjà calculable.
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
- **Ticker "en direct"** (`LiveTicker.tsx`, Jouer/Mes pronos, ne montre plus
  que les matchs IN_PROGRESS depuis le 06/10/2026) posé à
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
