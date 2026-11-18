# Chantier — Bêta NBA Cup réelle (décembre 2026)

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

## Lots proposés (exécution Sonnet, une branche `feat/beta-nba-cup`)
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

## Runbook (à compléter en L5)
- 28/11 matin : relever les 8 qualifiés → clôturer le Match du jour → « Détecter les quarts » (ou saisie) → créer la Cup.
- 30/11-01/12 : vérifier que la synchro a créé les 4 quarts et posé `bracket_deadline` (sinon repli manuel).
- Dès les quarts créés : recette garde SERIES (compte admin) et rendu d'un quart à pronostiquer.
- 05-06/12 : vérifier l'avancement des vainqueurs et la création des demies ; 09-10/12 : la finale.
- 12/12 : clôturer la Cup, relancer le Match du jour.

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
