# Multi-compétitions + NBA Cup — plan technique (enrichissement du prototype)

> Statut : plan validé avec l'utilisateur le 16/07/2026 (étape 2 du cadrage
> technique, après audit documentaire étape 1). Aucun code écrit à ce stade
> — ce document sert de feuille de route pour l'implémentation à venir.

## Contexte

Le prototype ne gère aujourd'hui qu'une seule compétition possible : un
singleton `competition_settings` + un script SQL manuel
(`sql/reset_simulation.sql`) à relancer à la main dans l'éditeur Supabase
pour "recommencer une saison". Deux décisions produit actées le 16/07/2026
(`Cadrage/nba_pronos_decisions_multi_competitions_historique.md` et
`Cadrage/nba_pronos_decisions_nba_cup_mecanique_scoring.md`) demandent
d'enrichir ce prototype pour :

1. **Multi-compétitions + historique** : transformer le singleton en vraie
   table `competitions` (ACTIVE/ARCHIVED), avec écrans admin de création et
   de clôture/archivage, et un onglet "Historique" côté joueur.
2. **Mécanique NBA Cup** : un mini-bracket de 7 matchs / 3 tours (quarts/
   demies/finale), sans série (donc sans "score exact"), avec un barème
   dédié (Vainqueur 20/50/150 + Affiche 0/15/25), qui coexiste avec le
   mécanisme bracket existant (0.2.2) réutilisé tel quel.

But de cette phase : valider la mécanique + l'équilibre du scoring + l'UX de
l'historique, **toujours en simulation, sans auth/RLS** (roadmap §8 du doc
multi-compétitions). Pas encore la V1 réelle.

Ce plan a été élaboré après exploration complète du code existant (moteur
bracket, moteur de scoring, écrans admin/joueur) pour identifier précisément
ce qui est déjà générique (réutilisable tel quel) vs. ce qui est codé en dur
pour les Playoffs (à généraliser).

**Simplification clé retenue** : une seule compétition ACTIVE à la fois, et
chaque nouvelle compétition **vide entièrement** les tables opérationnelles
(series/matches/brackets/bracket_picks/match_predictions/bets/
correction_requests) avant de semer la suivante — exactement comme
`reset_simulation.sql` le fait déjà aujourd'hui. Conséquence : **aucune
colonne `competition_id` n'est nécessaire sur ces tables opérationnelles**
(elles ne contiennent jamais que les données de la compétition en cours).
Seule la nouvelle table d'archive du classement a besoin de `competition_id`.

**Bug corrigé au passage** (trouvé pendant l'exploration, indépendant de
NBA Cup mais bloquant pour elle) : `lib/simulationAdvance.ts::resolveMatch`
code en dur le seuil de victoire de série à `4` (best-of-7). Une "série" NBA
Cup n'a qu'1 match — sans correctif, le premier match Cup ne se
résoudrait jamais (la fonction attendrait 4 victoires qui n'arriveront
jamais, insérant un match 2 fantôme).

**Décisions de conception tranchées avec l'utilisateur** (16/07/2026) :
- Sélection des équipes des matchs initiaux (1er tour Playoffs / quarts NBA
  Cup) : **sélecteurs manuels** (dropdowns admin), pas de tirage aléatoire —
  cohérent avec le fait que les vrais groupes NBA Cup 2026 sont déjà tirés.
  Une vraie API de qualification prendra le relais en V1.
- Colonnes mortes `competition_code` / `current_round` (aucun code ne les
  lit) : **supprimées** lors de la migration vers `competitions`.
- `sql/reset_simulation.sql` : **supprimé** une fois le nouvel écran
  "Nouvelle compétition" vérifié fonctionnel (fin de phase 6), pour éviter
  deux chemins de code divergents (hardcodé vs. générique).

---

## Migrations SQL (à coller à la main dans l'éditeur SQL Supabase, dans l'ordre)

Pas de CLI Supabase configurée dans ce repo (`supabase/` ne contient que
`.temp/`) — on continue le workflow actuel : SQL collé à la main, puis
`sql/schema_prototype.sql` resynchronisé à la main en documentation.

**001 — `competitions` (remplace `competition_settings`)**
```sql
create type competition_type as enum ('PLAYOFFS', 'NBA_CUP');
create type competition_status as enum ('ACTIVE', 'ARCHIVED');

alter table competition_settings rename to competitions;

alter table competitions
  add column name text,
  add column type competition_type,
  add column status competition_status not null default 'ACTIVE',
  add column archived_at timestamptz;

update competitions set name = 'Playoffs (legacy)', type = 'PLAYOFFS';

alter table competitions
  alter column name set not null,
  alter column type set not null,
  drop column competition_code,
  drop column current_round;

create unique index uniq_one_active_competition
  on competitions (status) where status = 'ACTIVE';
```
Renommage en place sûr : aucune FK n'entre dans `competition_settings`
aujourd'hui (vérifié).

**002 — nouveaux tours `playoff_round` (fichier séparé, exécuté seul)**
```sql
alter type playoff_round add value if not exists 'CUP_QUARTERS';
alter type playoff_round add value if not exists 'CUP_SEMIS';
alter type playoff_round add value if not exists 'CUP_FINAL';
```
Postgres interdit d'utiliser une valeur d'enum dans la même transaction que
celle qui l'a créée — ce fichier doit être collé et exécuté **seul**, attendre
la fin, avant tout fichier suivant qui référence ces valeurs.

**003 — `competition_archives` (nouvelle table)**
```sql
create table competition_archives (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id),
  user_id uuid not null references users(id),
  pseudo_snapshot text not null,
  rank int not null,
  total_points int not null,
  matches_points int not null,
  margin_bonus_points int not null,
  bracket_points int not null,
  bets_points int not null,
  correct_match_winners int not null,
  exact_margins int not null,
  created_at timestamptz not null default now(),
  unique (competition_id, user_id)
);
create index idx_competition_archives_competition on competition_archives (competition_id);
```
Miroir exact des colonnes de la vue `user_scores` + `rank` + `pseudo_snapshot`
(figé, car `users.pseudo` est mutable) + `competition_id`. Pas de colonne
"forme récente" : notion intrinsèquement glissante (7 jours), sans sens une
fois figée.

Après les 3 migrations : mettre à jour `sql/schema_prototype.sql` à la main
(section `competitions`, 3 nouvelles valeurs d'enum, bloc
`competition_archives`).

---

## Changements `lib/`

### `lib/bracketRounds.ts` (nouveau)

Source unique de vérité sur les tours, indexée **par valeur de tour**
(pas par type de compétition) — les 7 valeurs d'enum sont uniques
globalement, donc la plupart des écrans n'ont jamais besoin de savoir
"quel type de compétition est actif", ils lisent juste les tours présents
dans les `series` qu'ils ont chargées.

Contenu : `ROUND_LABELS`, `ROUND_ORDER` (remplacent les ~7 copies actuelles
dispersées dans `app/bracket/page.tsx`, `app/bracket-global/page.tsx`,
`app/paris-globaux/page.tsx`, `lib/botScripting.ts`) ; `isRootRound(round)`
(remplace les ~5 tests littéraux `round === 'ROUND_1'`) ;
`usesConferenceGrouping(round)` ; `showScoreFormatButtons(round)` (false
pour les 3 tours Cup — pas de score de série) ; `winsNeededForRound(round)`
(4 pour les tours Playoffs, 1 pour les tours Cup — corrige le bug
`resolveMatch`) ; `ROUND_ORDER_BY_TYPE` (consommé uniquement par
`lib/competitionSetup.ts` pour semer une compétition d'un type donné).

### `lib/scoringEngine.ts`

- `BRACKET_POINTS` (ligne ~58) : ajouter `CUP_QUARTERS: {winner:20,
  exactScore:0, matchup:0}`, `CUP_SEMIS: {winner:50, exactScore:0,
  matchup:15}`, `CUP_FINAL: {winner:150, exactScore:0, matchup:25}`.
- Supprimer le test `s.round !== 'ROUND_1'` (ligne ~119) : déjà redondant
  avec `matchup: 0` sur `ROUND_1` dans la table — `getPredictedMatchupTeams`
  renvoie déjà `[null, null]` pour tout tour racine (rien ne l'alimente),
  donc `isMatchupCorrect` reste `false` sans ce garde-fou. Suppression sans
  impact sur les Playoffs, et rend `CUP_QUARTERS` correct automatiquement.
- Garder `is_score_exact`/`exact_score_points` (ligne ~115) mais ajouter la
  condition `s.official_score_format != null` : aujourd'hui, avec
  `predicted_score_format` et `official_score_format` tous les deux `null`
  (permanent pour NBA Cup), la comparaison `null === null` vaut `true` à
  tort. Neutre sur les points (`exactScore: 0` pour tous les tours Cup),
  mais fausse le flag `is_score_exact` affiché.

### `lib/simulationAdvance.ts`

- `autoResolveBracketsAtDeadline` (ligne ~168) :
  `.from('competition_settings')` → `.from('competitions').eq('status',
  'ACTIVE')`.
- `resolveMatch` (ligne ~250) : remplacer `team1Wins === 4` /
  `team2Wins === 4` par `winsNeededForRound(series.round)` importé de
  `lib/bracketRounds.ts`. Ne calculer/écrire `official_score_format` que si
  `winsNeeded === 4` (le laisser `null` pour les tours Cup).
- `advanceWinnerToNextSeries` : aucun changement — déjà générique sur
  l'arbre (`next_series_id`/`next_series_slot`), réutilisable tel quel pour
  l'arbre à 7 séries de la Cup.

### `lib/competitionSetup.ts` (nouveau) — moteur vider + semer

```ts
export async function wipeOperationalData(): Promise<void>
export async function seedCompetition(input: {
  competitionId: string
  type: CompetitionType
  matchups: { conference: 'EAST'|'WEST'|null; slotIndex: number; team1Id: string; team2Id: string }[]
  kickoffAt: Date
}): Promise<void>
```

`wipeOperationalData()` reprend l'ordre anti-FK-circulaire de
`reset_simulation.sql` (vider `correction_request_id` sur
`match_predictions`/`bets` avant de supprimer `correction_requests`, puis
`match_predictions` → `bets` → `bracket_picks` → `brackets` → `matches`),
**plus** `DELETE FROM series` (différence structurelle : le script actuel
réutilise les 15 lignes `series` en place car la topologie ne change jamais ;
maintenant qu'on alterne 15 séries/4 tours Playoffs et 7 séries/3 tours NBA
Cup, il faut reconstruire l'arbre à chaque nouvelle compétition).

`seedCompetition()` construit l'arbre en 2 passes (un `next_series_id` doit
pointer vers une ligne qui n'existe pas encore quand le tour "feuille" est
inséré) : (1) insérer les `series` de chaque tour dans l'ordre
(`ROUND_ORDER_BY_TYPE[type]`), tour feuille avec équipes fournies par
`matchups`, tours suivants avec équipes `null` ; (2) mettre à jour les lignes
du tour précédent avec `next_series_id`/`next_series_slot` vers le tour
suivant. Puis : insérer les matchs `game_number=1` du tour feuille à
`kickoffAt` ; poser `competitions.bracket_deadline = kickoffAt` ; ressemer
`simulation_state` (nouveau seed, `cursor_at = now()`, comme aujourd'hui).

---

## Changements `app/`, fichier par fichier

| Fichier | Changement |
|---|---|
| `app/bracket/page.tsx` | Supprimer `ROUND_LABELS`/`ROUND_ORDER` locaux, importer `lib/bracketRounds.ts`. `round === 'ROUND_1'` (groupement conférence + résolution des candidats) → `usesConferenceGrouping`/`isRootRound`. Encadrer les boutons de score de série dans `showScoreFormatButtons(round)`. |
| `app/bracket/actions.ts` | `assertBracketNotLocked` : `competition_settings` → `competitions.eq('status','ACTIVE')`. `getValidCandidateTeamIds` : `isRootRound`. Garde-fou serveur dans `saveBracketPick` : rejeter un `scoreFormat` envoyé sur un tour où `!showScoreFormatButtons`. |
| `app/bracket-global/page.tsx` | Supprimer `ROUND_LABELS`/`ROUND_ORDER` locaux. `competition_settings` → `competitions.eq('status','ACTIVE')`. Détection champion `s.round === 'NBA_FINALS'` → `s.next_series_id === null` (générique, vrai aussi pour `CUP_FINAL`). Liste de tours à afficher dérivée dynamiquement des `series` chargées (triée par `ROUND_ORDER`) plutôt que le tableau à 4 valeurs codé en dur. Texte de résultat : repli sans suffixe de score si `official_score_format === null`. |
| `app/paris-globaux/page.tsx` | Supprimer `ROUND_LABELS`/`ROUND_ORDER` locaux, importer `lib/bracketRounds.ts`. Pas d'autre changement — le bloc "Paris SÉRIE" est déjà conditionné sur une liste vide, qui le sera automatiquement une fois la création SÉRIE bloquée pour NBA Cup (ligne suivante). |
| `app/paris/actions.ts` | Garde-fou en tête de `upsertActiveSeriesBet` : lire le type de la compétition ACTIVE, rejeter si `NBA_CUP` ("Les paris SÉRIE n'existent pas pour une NBA Cup"). C'est le vrai point d'application (defense in depth), les séries NBA Cup existent bel et bien en base donc la liste n'est pas vide naturellement. |
| `app/paris/page.tsx` | Si compétition active `NBA_CUP` : forcer `eligibleSeriesForNewBet = []`, ne pas rendre `<SeriesBetForm>`. |
| `lib/botScripting.ts` | Supprimer `ROUND_ORDER` local, importer `lib/bracketRounds.ts`. `competition_settings` → `competitions.eq('status','ACTIVE')`. `s.round === 'ROUND_1'` → `isRootRound`. Ne choisir un `predicted_score_format` que si `showScoreFormatButtons`. `fillBets` : sauter entièrement le bloc "pari SÉRIE" si compétition active `NBA_CUP`. |
| `lib/betQueries.ts`, `lib/betQuota.ts` | Aucun changement — logique déjà agnostique du scope, le garde-fou vit dans les appelants ci-dessus. |
| `app/pronos/`, `lib/simulationEngine.ts` | Aucun changement — fonctionnent déjà uniquement sur `matches`, sans notion de tour/série. |
| `app/admin/paris/`, `app/admin/corrections/` | Aucun changement (vérifié : ne référencent ni `competition_settings` ni les enums de tour). |

---

## Nouveaux écrans

### `app/admin/competitions/new/` (page + actions)

Formulaire : `name`, `type` (PLAYOFFS/NBA_CUP), `kickoffAt` (devient
`bracket_deadline` + `scheduled_at` de tous les matchs du tour feuille).
Sélecteurs manuels d'équipes sous le type (rendu conditionnel via
search-param `type`, cohérent avec le pattern URL-driven déjà utilisé
partout dans l'app) : 16 `<select>` groupés par conférence pour PLAYOFFS, 8
`<select>` sans groupement pour NBA_CUP.

`createCompetition(formData)` : garde "une seule compétition ACTIVE à la
fois" (message clair avant de laisser l'index partiel unique rejeter) ;
validation (équipes distinctes, conférence cohérente si PLAYOFFS) ; insert
`competitions` ; `wipeOperationalData()` puis `seedCompetition(...)`.

### `app/admin/competitions/close/` (page de confirmation dédiée)

Action irréversible ("aucune correction possible après clôture") → écran de
confirmation séparé (pas un bouton perdu sur le dashboard `/admin`), avec
aperçu du classement actuel avant de valider.

`closeAndArchiveCompetition()` : `recalculateAllScores()` (filet de
sécurité) → snapshot `user_scores` + `users` dans `competition_archives`
(rang calculé avec la logique de tri extraite, cf. ci-dessous) →
`wipeOperationalData()` → `competitions.status='ARCHIVED'`,
`archived_at=now()`.

### `app/profil/page.tsx` (nouveau — aucun écran profil n'existe aujourd'hui)

Liste de liens `?competition=<id>` vers les compétitions `ARCHIVED` (plus
récente par défaut), classement figé de la compétition sélectionnée depuis
`competition_archives` — même colonnes que `/classement` sauf "Forme (7j)"
(notion glissante, sans sens figée). Utilise `pseudo_snapshot`, pas un join
vers `users.pseudo` (protège contre un pseudo renommé après coup).

Lien simple `→ Historique` ajouté sur `/classement` (aucune nav globale
n'existe dans l'app aujourd'hui — cohérent avec la fidélité UX "MOYENNE"
déjà actée).

### `lib/leaderboardSort.ts` (nouveau, extraction)

`getSortValue`/`compareScores` de `app/classement/page.tsx` (lignes ~19-47)
sont déjà pures et agnostiques du type de source de données — extraites ici
pour être réutilisées telles quelles par `/profil` (2e point d'appel,
seuil raisonnable pour sortir du "no premature abstraction").

---

## Ordre d'implémentation (vérifiable à chaque étape)

1. **Schéma** — migrations 001→002→003 (002 seule, validée, avant tout le
   reste). Resynchroniser `sql/schema_prototype.sql`.
   *Vérif* : `competitions` a bien 1 ligne `ACTIVE`/`PLAYOFFS` ; l'enum
   `playoff_round` a 7 valeurs ; `competition_archives` existe, vide.

2. **Refactor `lib/` (Playoffs uniquement, aucune nouvelle capacité)** —
   `lib/bracketRounds.ts`, les 4 sites `ROUND_LABELS`/`ROUND_ORDER` + 5
   tests `=== 'ROUND_1'`, les 4 lecteurs de `competition_settings`, les 3
   correctifs `scoringEngine.ts`, le correctif `winsNeededForRound`.
   *Vérif (bloquante)* : rejouer le flux Playoffs existant de bout en bout
   (avancer les jours, bots, recalcul, `/classement`) — comportement
   strictement identique à avant. Toute différence observable est une
   régression à corriger avant de continuer.

3. **`lib/competitionSetup.ts` + écrans admin** (Nouvelle compétition /
   Clôturer et archiver) + liens dashboard.
   *Vérif* : créer une compétition PLAYOFFS via le nouvel écran avec les
   mêmes matchups que `Données de départ.txt` ; comparer l'état
   `series`/`matches` résultant à celui produit par l'ancien script ;
   rejouer la régression complète dessus ; clôturer/archiver ; vérifier que
   `competition_archives` contient 1 ligne par joueur cohérente avec le
   `/classement` juste avant clôture, et que les tables opérationnelles
   sont vides.

4. **Chemin NBA Cup** — garde-fous scope SÉRIE
   (`app/paris/actions.ts`, `app/paris/page.tsx`, `lib/botScripting.ts`).
   Créer une compétition NBA_CUP (8 équipes, 4 matchs, pas de conférence).
   *Vérif* : écran bracket affiche 3 tours correctement labellisés, sans
   boutons de score ; humain + bots remplissent les 3 tours ; avancer le
   temps simulé sur les 7 matchs ; chaque "série" Cup passe `FINISHED` dès
   le match 1 (preuve du correctif `winsNeededForRound`) ;
   `official_score_format` reste `null` ; scoring conforme à 20/50/150 +
   0/15/25, `is_score_exact` toujours `false`. Clôturer/archiver.

5. **`/profil`** — extraire `lib/leaderboardSort.ts` (vérifier que
   `/classement` rend à l'identique après ce refactor), puis construire
   `app/profil/page.tsx`.
   *Vérif* : les 2 compétitions archivées aux étapes 3 et 4 sont
   sélectionnables, classements figés cohérents avec ce qu'affichait
   `/classement` juste avant chaque clôture respective.

6. **Nettoyage** — supprimer `sql/reset_simulation.sql` (superseded).
   Parcours complet final : PLAYOFFS → clôture → NBA_CUP → clôture → les
   deux visibles correctement dans `/profil`, tables opérationnelles vides
   après chaque clôture, aucune violation de contrainte "1 seule ACTIVE" à
   aucun moment.

---

## Fichiers critiques

- `sql/schema_prototype.sql` — resynchronisation finale après migrations
- `lib/bracketRounds.ts` (nouveau)
- `lib/competitionSetup.ts` (nouveau)
- `lib/leaderboardSort.ts` (nouveau)
- `lib/simulationAdvance.ts` — correctif `winsNeededForRound` + lecteur `competitions`
- `lib/scoringEngine.ts` — nouvelles clés `BRACKET_POINTS` + 2 correctifs
- `lib/botScripting.ts` — round-config partagée + garde NBA Cup sur les paris SÉRIE
- `app/bracket/page.tsx`, `app/bracket/actions.ts`, `app/bracket-global/page.tsx`
- `app/paris/page.tsx`, `app/paris/actions.ts`, `app/paris-globaux/page.tsx`
- `app/admin/competitions/new/actions.ts` (nouveau)
- `app/admin/competitions/close/actions.ts` (nouveau)
- `app/profil/page.tsx` (nouveau)

À la fin de la session : mettre à jour `Cadrage/ETAT_ACTUEL.md`,
`Cadrage/GAPS_OUVERTS.md` et `Cadrage/JOURNAL_SESSIONS.md` pour refléter le
travail fait (par étape/phase terminée), conformément à la convention du
projet.
