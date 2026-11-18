# Chantier — Bêta NBA Cup réelle (décembre 2026)

> **Statut 18/11/2026 (exécution) : L1 à L6 faits (branche `claude/beta-nba-cup-430d34`, PR #311).**
>
> **L4 (sonde faite le 18/11, 2 appels `/matches` (17/11 puis 14/11), 90 requêtes restantes) :** les matchs NBA (dont Cup, mardi) portent `league: "NBA"`, statut `Finished`. Un match ne porte que `id, league, season, date, state, homeTeam, awayTeam` : **aucun champ de phase/tour** (idem le 14/11 : 5 matchs NBA, tous `league: "NBA"`, `Finished`, mêmes champs), donc impossible de distinguer un match de Cup d'un match de saison régulière côté API. Filtre `lib/nba/client.ts` inchangé (aucun besoin de l'élargir). Conséquence pour L6 : discriminant = « exactement 4 matchs, 8 équipes, 2 par conférence » ; si des matchs de saison régulière tombent les 04-05/12, la détection refuse et l'admin saisit à la main. À re-vérifier sur les vrais quarts le 28/11.

Cadrage du 18/11/2026. Statut : **décisions prises le 18/11** (voir en bas), prêt pour l'exécution.

## Calendrier officiel 2026 (source nba.com, vérifié le 18/11)
- Phase de groupes : 30/10 → 27/11. 8 qualifiés (6 vainqueurs de groupe + 1 wild card par conférence).
- **Quarts : ven. 04/12 et sam. 05/12** (chez le mieux classé). Demies : 08/12 et/ou 09/12 (idem).
- Finale : ven. 11/12, Hinkle Fieldhouse (Indianapolis).
- Fenêtre bracket : affiches connues au plus tard le 28/11 matin (Paris) → premier quart le 04/12 au soir.
  « Bêta 04/12 » = date du premier match, pas date d'ouverture : la compétition doit exister dès le 28/11.

## Ce qui existe déjà (vérifié dans le code)
- Création admin d'une compétition `NBA_CUP` avec 4 affiches de quarts (`lib/actions/admin-competitions.ts`,
  `createCupBracket`) : 7 séries (4 `CUP_QUARTERS`… 2 `CUP_SEMIS`, 1 finale), chaînées par `next_series_id`.
- Synchro calendrier (`lib/sync/schedule.ts`) : un match jamais vu est rattaché à sa série par la **paire
  d'équipes** (déterministe). Les demies/finale reçoivent leurs équipes via `advanceWinnerIfDecided`.
- Garde SQL : `create_bet` refuse `scope = 'SERIES'` hors `PLAYOFFS` (migration `20261007100000`) ;
  côté TS, `allowsSeriesBets()` / `isSingleMatchSeries()` (`lib/competitions/types.ts`).

## Constats du cadrage
1. **Le « mapping automatique A7 » se réduit à la création du bracket.** Une fois les 4 quarts en base, la
   synchro rattache déjà les matchs tout seule. Reste à automatiser la détection des 4 quarts (décision n°2 :
   on la construit, voir L6). Piège : l'horizon de synchro est de 4 jours, les quarts du 04/12 n'y entrent
   que vers le 30/11 ; la détection doit interroger directement les dates des quarts.
2. **Trou : l'échéance du bracket n'est jamais posée par la synchro.** `recomputeBracketDeadline` n'est appelé
   que par la saisie admin de matchs/résultats (`lib/actions/admin-results.ts`). Matchs créés par la synchro
   → `bracket_deadline` reste NULL → bracket jamais verrouillé, rappel de bracket jamais envoyé. (L'alpha
   passait par des scripts.) À corriger.
3. **Ordre des quarts ambigu dans le formulaire.** Les demies associent Quart 1+2 et Quart 3+4 ; dans la vraie
   Cup, les quarts Est se retrouvent entre eux (idem Ouest). Les libellés « Quart 1..4 » ne le disent pas :
   risque de bracket faux à la saisie. Libellés à passer en « Est — Quart 1/2 », « Ouest — Quart 1/2 ».
4. **Une seule compétition ACTIVE à la fois** (`uniq_one_active_competition`, ~49 fichiers lisent « la »
   compétition active). Le Match du jour en cours bloque la création de la Cup. Lever la contrainte = gros
   chantier, irréaliste avant le 28/11 → décision n°1.
5. **Risque non sondé : Highlightly et les matchs Cup.** `getMatchesByDate` ne garde que `league === "NBA"`.
   Si les matchs à élimination directe portent un autre libellé, la synchro ne les voit pas. Sondable dès
   maintenant sur un match de groupe (mêmes données côté NBA), à confirmer sur un quart le 28/11.
   Repli existant : création manuelle des matchs en admin.
6. **Garde SERIES et rendu « à pronostiquer »** : testables sans risque une fois la compétition créée
   (appel `create_bet` SERIES avec un compte admin → refus attendu, rien d'écrit ; affichage d'un quart
   `SCHEDULED` sur `/play`). Avant, on peut les couvrir par tests unitaires purs.

## Lots proposés (exécution Sonnet, une branche `claude/beta-nba-cup-430d34`)
- **L1 — Échéance du bracket** : après création de matchs dans `syncSchedule`, recalculer `bracket_deadline`
  (extraire `recomputeBracketDeadline` dans un module partagé). Test unitaire dans `lib/sync/schedule.test.ts`.
- **L2 — Formulaire** : libellés Est/Ouest des quarts + aide « Quart 1 et 2 = même demie ».
- **L3 — Garde-fous TS** : tests purs vérifiant qu'aucune entrée UI ne propose un pari SÉRIE en `NBA_CUP`
  (repérer où `allowsSeriesBets` est consulté ; le brancher là où il manque).
- **L4 — Sonde Highlightly** (1-2 appels, quota) : relever `league`, statut et équipes d'un match de groupe.
  Si le libellé diffère : élargir le filtre de `lib/nba/client.ts` aux matchs Cup.
- **L6 — Détection automatique des quarts** (`lib/sync/cupQuarters.ts` + bouton admin « Détecter les quarts »
  sur `/admin/competitions/new`) : interroge Highlightly sur les dates des quarts (04-05/12, en constante
  datée), retient les matchs entre équipes mappées, range Est/Ouest via `teams.conference` (Est = Quart 1/2),
  **propose** les 4 affiches pré-remplies dans le formulaire ; l'admin confirme, `createCupBracket` crée.
  Pas de création sans clic (un faux positif casserait toute la compétition). Discriminant à fixer après L4 :
  champ de phase/tour Highlightly s'il existe, sinon « exactement 4 matchs, 8 équipes distinctes, 2 par
  conférence » sur ces dates ; tout autre résultat → message clair et saisie manuelle (repli L2).
  Tests purs sur le tri et les cas 0/3/5 matchs, équipes en double, conférences déséquilibrées.
- **L5 — Runbook admin** (dans ce fichier) : J-0 28/11, contrôles J+2 (quarts créés, échéance posée),
  recette réelle garde SERIES + rendu `/play`, clôture après la finale.

## Runbook admin (L5, complété le 18/11)

### Ce que coupe la clôture du Match du jour (vérifié dans le code)
- **Tirage quotidien** (`/api/daily-match/draw`, crons Vercel 5h/7h UTC + workflow de secours) : borné par des
  constantes (`DAILY_MATCH_FIRST_DAY/LAST_DAY/CRON_START`, `lib/dailyMatch/draw.ts`, dernier jour 27/11). Après le
  27/11 le cron répond « hors période » en 2xx : **aucune alerte**. Sans compétition ACTIVE ou avec une Cup active,
  un lancement manuel lève une erreur (500) — ne pas le lancer.
- **Récaps / push** (`lib/recaps/sendRecaps.ts`) : lisent la compétition ACTIVE. Entre la clôture et la création de
  la Cup : « aucune compétition active », rien n'est envoyé. Avec la Cup (non DAILY) : récap sans annonce « match du jour ».
- **Synchro calendrier/résultats** : travaille sur la compétition ACTIVE ; sans compétition, no-op. La synchro n'a
  jamais créé de matchs en DAILY_MATCH.
- Données conservées : la clôture archive le classement (`competition_archives`), rien n'est supprimé.

### Relancer le Match du jour le 12/12
1. Clôturer la Cup (admin, après la finale du 11/12 soldée).
2. Créer la nouvelle compétition « Match du jour » (type DAILY_MATCH).
3. Les bornes du tirage sont des **constantes de code** : prévoir une petite PR (nouvelles dates dans
   `lib/dailyMatch/draw.ts` : premier jour, dernier jour, début du cron) AVANT le 12/12, sinon le cron reste en « hors période ».
4. Lancer un tirage manuel (workflow `daily-match-draw.yml`, `from`/`to`) pour les 7 premiers jours ; vérifier le premier push de 10h.

### Un inscrit voit la compétition active sans rien rejoindre (vérifié)
Il n'existe pas de table d'adhésion à une compétition : `/play`, bracket, classement lisent « la » compétition
`status = 'ACTIVE'`. `join_code` ne sert qu'à l'inscription (`verify_join_code`). Les inscrits existants voient donc la
Cup dès sa création ; les invités restent en lecture seule. À confirmer visuellement le 28/11 avec un compte de test.

### Chronologie
- **28/11 matin** : relever les 8 qualifiés ; clôturer le Match du jour ; sur `/admin/competitions/new` cliquer
  « Détecter les quarts » (appelle Highlightly 2 fois, rien n'est créé), **vérifier chaque affiche** (Est — Quart 1 et 2 =
  même demie, idem Ouest), saisir le nom, créer la Cup. Si la détection refuse (≠ 4 matchs, conférences…), saisie manuelle.
- **28/11-01/12** : vérifier que la synchro (cron 8h UTC) rattache les matchs dès qu'ils entrent dans l'horizon de 4 jours
  (~30/11 pour le 04/12) et que `competitions.bracket_deadline` est posée au premier quart (sinon repli : saisie admin d'un match).
- **Dès les quarts créés** : recette garde SERIES (compte admin, appel `create_bet` SERIES → refus attendu, rien d'écrit)
  et rendu d'un quart `SCHEDULED` sur `/play`.
- **Garde par date (code, `lib/competitions/cupWindows.ts`)** : la synchro ne rattache un match à une série de Cup que
  s'il tombe dans les jours NY officiels du tour : quarts 04-05/12, demies 08-09/12, finale 11/12. Un match hors fenêtre
  (ex. saison régulière entre les mêmes équipes) est ignoré et journalisé « hors fenêtre officielle du tour ». Si la NBA
  décale un tour, corriger les dates dans ce fichier. Contrôle visuel quand même : comparer avec le tableau nba.com.
- **05-06/12** : vérifier l'avancement des vainqueurs et la création des demies ; **09-10/12** : la finale.
- **12/12** : clôturer la Cup, relancer le Match du jour (voir ci-dessus).

## Risques
- Affiches connues tard le 27/11 (heure US) : création le 28/11 seulement.
- Statuts Highlightly non reconnus sur ces matchs → déjà journalisés dans `sync_logs`.
- Finale hors stats de saison régulière : sans effet sur le score, à surveiller côté modèles de proba.

## Critère de fin
Cup créée et jouable le 28/11, quarts rattachés automatiquement, bracket verrouillé au premier quart,
garde SERIES et rendu `/play` constatés en réel, runbook suivi jusqu'à la clôture.

## Décisions (18/11/2026)
1. **Pause du Match du jour** : clôture le 28/11, Cup créée, nouveau Match du jour le 12/12. Pas de changement
   de schéma. Vérifier en L5 ce que la clôture coupe (tirage quotidien, push « Match du jour ») et ce qu'il
   faut pour relancer proprement.
2. **Mapping automatique construit** (L6), sous forme de proposition confirmée par l'admin.
3. **Tous les inscrits jouent** (invités en lecture seule, comme aujourd'hui). À vérifier en L5 : un inscrit
   voit la compétition active sans rien rejoindre (le `join_code` ne sert qu'à l'inscription).
