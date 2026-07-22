# NBA Pronos — SPEC TECHNIQUE T1 — MODÈLE DE DONNÉES V0.1

> **Nature** : fichier thématique T1 du découpage acté dans le document maître
> `SPEC_TECHNIQUE_V0.1.md` (§4). Il contient le **schéma V1 complet** (tables,
> enums, contraintes, index, vues) et un **diff explicite** vs
> `schema_prototype.sql`. Il ne contient **aucune policy RLS** (→ T3), **aucune
> route ni server action** (→ T6), **aucun design token** (→ T7).
>
> **Dépend de** : `SPEC_TECHNIQUE_V0.1.md` (le cadre). Ne rouvre aucune décision
> produit close (synthèse, SPEC_FONCTIONNELLE_V0_2) ni technique close
> (PREP_SPEC_TECHNIQUE_V1, §7 D1-D6 du maître).
>
> **Statut** : **VALIDÉ** avec l'utilisateur le 18/07/2026. Les 7 points qui
> étaient ouverts à la rédaction (mécanisme de cohérence de D2, périmètre des
> index de quotas, durcissement P6, forme de `sync_logs`, libellés de
> `bet_category`, `proposed_category` sur `correction_requests`,
> `unique(abbreviation)` sur `teams`) sont désormais **actés** (§9) et ont le
> même statut non rouvrable que les décisions du maître. Prochaine étape : la
> migration initiale (§8), qui ne partira en `db push` qu'après feu vert
> explicite.
>
> **Périmètre** : V1 complète, Playoffs **et** NBA Cup, dans les mêmes tables
> (une « série » NBA Cup est une série dégénérée à 1 match, cf. §3.4).

---

## 0. Résumé du chantier T1

Quatre chantiers connus (du brief de session) + les points de vigilance du
maître, traités ici :

```text
1. Re-scoping par competition_id (D2)  → §3 (colonnes) + §4 (cohérence) + §5 (vues)
2. Refonte de users (PK auth, -email, +thème)  → §3.2
3. Suppression des artefacts proto     → §2 (enums) + §3.2 + §7 (diff)
4. Ajouts V1 : sync_logs, catégorie de pari  → §3.13 + §3.12 + §2
```

Deux conséquences de D2 qui dépassent « ajouter une colonne » et sont donc
mises en avant :

- **§5 — les vues de classement passent au grain `(competition_id, user_id)`.**
  Le proto sommait tout l'historique d'un joueur ; c'était juste *parce qu'*une
  seule compétition existait à la fois. La rétention D2 impose de filtrer par
  compétition. Effet de bord voulu : débloque all-time + courbe d'évolution
  (BACKLOG_V1) sans les construire.
- **§4 — cohérence du `competition_id` dénormalisé par FK composites** (acté),
  pas par trigger : garantie au niveau DB, sans code, sans trigger.

---

## 1. Vue d'ensemble du diff (avant le détail)

| Élément | Statut V1 | En un mot |
|---|---|---|
| enums `competition_*`, `user_*`, `conference`, `playoff_round`, `series_*`, `match_*`, `bet_*`, `correction_*`, `mapping_*` | **repris** | validés au proto, inchangés |
| enum `bot_profile`, `simulation_mode`, `simulation_granularity` | **supprimés** | artefacts proto |
| enum `theme_preference` | **ajouté** | 0.2.9 §2 |
| enum `bet_category` | **ajouté** | C3 (9 catégories) |
| enum `sync_type` | **ajouté** | structuration de `sync_logs` |
| table `competitions` | **reprise** | inchangée |
| table `users` | **modifiée** | PK = `auth.users.id`, −`email`, −`is_primary_human`, −`bot_profile`, +`theme_preference` |
| table `teams` | **reprise (sémantique changée)** + `unique(abbreviation)` | désormais **globale et persistante** (D6) |
| table `series` | **modifiée** | +`competition_id` (structurel) |
| table `matches` | **modifiée** | +`competition_id` (dénormalisé) |
| table `entity_mappings` | **reprise** | `source_type`='HIGHLIGHTLY' |
| table `brackets` | **modifiée** | +`competition_id`, `unique(user_id)`→`unique(user_id, competition_id)` |
| table `bracket_picks` | **modifiée** | +`competition_id` (dénormalisé), +CHECK≥0 |
| table `match_predictions` | **modifiée** | +`competition_id` (dénormalisé), +CHECK≥0 |
| table `bets` | **modifiée** | +`competition_id`, +`proposed_category`/`validated_category`, +CHECK≥0 |
| table `correction_requests` | **modifiée** | +`proposed_category` (symétrie) |
| table `audit_logs` | **reprise** | inchangée (= `admin_logs` de B2) |
| table `sync_logs` | **ajoutée** | B3 |
| table `simulation_state` | **supprimée** | artefact proto |
| table `competition_archives` | **reprise** | inchangée |
| vue `user_scores` | **modifiée** | grain `(competition_id, user_id)` + `security_invoker` (D4) |
| vue `user_recent_form` | **modifiée** | grain `(competition_id, user_id)` + `security_invoker` (D4) |

Le §7 détaille chaque écart avec son **pourquoi**.

---

## 2. Types énumérés

```sql
create extension if not exists pgcrypto;

-- ── REPRIS À L'IDENTIQUE (validés au proto) ────────────────────────────────
create type competition_type as enum ('PLAYOFFS', 'NBA_CUP');
create type competition_status as enum ('ACTIVE', 'ARCHIVED');
create type user_role as enum ('PLAYER', 'ADMIN');
create type user_status as enum ('ACTIVE', 'DISABLED');           -- PENDING écarté (B1)
create type conference as enum ('EAST', 'WEST');
create type playoff_round as enum (
  'ROUND_1', 'CONF_SEMIS', 'CONF_FINALS', 'NBA_FINALS',           -- Playoffs (8/4/2/1)
  'CUP_QUARTERS', 'CUP_SEMIS', 'CUP_FINAL'                        -- NBA Cup  (4/2/1)
);
create type series_format as enum ('4-0', '4-1', '4-2', '4-3');   -- NULL pour la Cup
create type series_status as enum ('SCHEDULED', 'IN_PROGRESS', 'FINISHED', 'POSTPONED', 'CANCELLED');
create type match_status  as enum ('SCHEDULED', 'IN_PROGRESS', 'FINISHED', 'POSTPONED', 'CANCELLED');
create type match_prediction_status as enum ('DRAFT', 'VALIDATED', 'LOCKED');
create type bet_scope  as enum ('SERIES', 'MATCH');
create type bet_status as enum ('DRAFT', 'SUBMITTED', 'VALIDATED', 'REJECTED', 'WON', 'LOST', 'CANCELLED');
create type correction_request_status as enum ('PENDING', 'PROCESSED', 'REJECTED');
create type correction_target_type as enum ('MATCH_PREDICTION', 'BET');
create type mapping_entity_type as enum ('TEAM', 'SERIES', 'MATCH');
create type mapping_status as enum ('PENDING', 'CONFIRMED');

-- ── AJOUTÉS EN V1 ──────────────────────────────────────────────────────────

-- Préférence de thème (0.2.9 §2 : « fond SOMBRE par défaut, bascule CLAIR »).
-- Défaut DARK conforme à la décision fonctionnelle — pas un point ouvert.
create type theme_preference as enum ('LIGHT', 'DARK');

-- Catégorie de pari personnalisé (C3). 9 catégories FIXES, proposée par le
-- joueur, corrigeable par l'admin au même geste que la difficulté.
-- Libellés de code EN ↔ libellé fonctionnel FR (C3), actés le 18/07/2026 :
--   PLAYER_PROP        = Pari joueur
--   SCORE_TOTAL        = Score / total match
--   TEAM_PROP          = Pari équipe
--   PERIOD             = Pari période
--   HEAD_TO_HEAD       = Comparaison / duel
--   PLAYING_TIME       = Rotation / temps de jeu
--   MULTI_PLAYER_COMBO = Combo multi-joueurs
--   GAME_EVENT         = Événement de match
--   FUN_OFF_COURT      = Fun / hors terrain
create type bet_category as enum (
  'PLAYER_PROP', 'SCORE_TOTAL', 'TEAM_PROP', 'PERIOD', 'HEAD_TO_HEAD',
  'PLAYING_TIME', 'MULTI_PLAYER_COMBO', 'GAME_EVENT', 'FUN_OFF_COURT'
);

-- Type de job de synchro, pour structurer/filtrer sync_logs (B3, A8).
--   TEAMS     = rafraîchissement du référentiel des 30 équipes (hors compétition, D6)
--   SCHEDULE  = calendrier/horaires (1x/jour, A8)
--   RESULTS   = résultats/statuts (30-60 min en fenêtre de match, A8)
--   HEARTBEAT = ping anti-pause Supabase (toute l'année, A8)
create type sync_type as enum ('TEAMS', 'SCHEDULE', 'RESULTS', 'HEARTBEAT');

-- ── SUPPRIMÉS (artefacts proto) ────────────────────────────────────────────
-- bot_profile, simulation_mode, simulation_granularity : n'existent pas en V1.
```

---

## 3. Tables

Ordre de création cohérent avec les dépendances de clés étrangères (récapitulé
au §8). Les commentaires sont en français, les identifiants en anglais (P11).

### 3.1 `competitions` — REPRISE (inchangée)

```sql
create table competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type competition_type not null,
  status competition_status not null default 'ACTIVE',
  -- Deadline du bracket = heure du 1er match du tour feuille (1er tour
  -- Playoffs / quarts NBA Cup). Nulle tant que ce tour n'est pas semé.
  bracket_deadline timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Une seule compétition ACTIVE à la fois (pas de participation concurrente).
create unique index uniq_one_active_competition
  on competitions (status) where status = 'ACTIVE';
```

### 3.2 `users` — MODIFIÉE

```sql
create table users (
  -- MODIFIÉ (D5 / arbitrage D) : la PK EST l'id de auth.users. Plus de
  -- gen_random_uuid() : l'id vient de l'inscription Supabase Auth (T2).
  -- Permet des policies en `user_id = auth.uid()` sans jointure (T3).
  id uuid primary key references auth.users(id) on delete cascade,
  pseudo text not null unique,                 -- identité PUBLIQUE (C4)
  -- SUPPRIMÉ (D5) : colonne `email`. L'email est l'identifiant technique de
  -- Supabase Auth, il vit dans auth.users. La RLS filtrant des LIGNES et non
  -- des COLONNES, le garder ici l'exposerait via la vue de classement (D4/D5).
  avatar_url text,
  favorite_team_id uuid references teams(id),  -- teams désormais globale (D6)
  bio text,
  role user_role not null default 'PLAYER',
  status user_status not null default 'ACTIVE',
  -- AJOUTÉ (0.2.9 §2) : préférence de thème, sombre par défaut.
  theme_preference theme_preference not null default 'DARK',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
  -- SUPPRIMÉ : is_primary_human (le compte humain unique disparaît avec l'auth réelle)
  -- SUPPRIMÉ : bot_profile (plus de faux joueurs scriptés en V1)
);
```

> Note : `favorite_team_id` peut être une FK inline en V1 car `teams` est créée
> avant `users` (§8), là où le proto la déclarait en `alter table` différé.

### 3.3 `teams` — REPRISE (sémantique changée : globale et persistante)

```sql
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  abbreviation text not null,
  conference conference not null,
  logo_url text,                    -- conservée, mais non lue pour l'affichage depuis l'amendement 21/07/2026
                                     -- (logos SVG en dépôt, public/logos/teams/ — voir SYNCHRO §4) ; fallback théorique seulement
  created_at timestamptz not null default now(),
  -- Durcissement acté (18/07/2026) : les 30 abréviations NBA sont uniques ;
  -- empêche un doublon d'équipe en cas de synchro fautive du référentiel (D6).
  unique (abbreviation)
);
```

> **Changement de sémantique (pas de colonne, mais important)** : en V1 `teams`
> est un **référentiel global de 30 équipes**, synchronisé **une fois pour
> toutes** via `GET /teams` (D6), **jamais vidé**, **partagé par toutes les
> compétitions**. Au proto, les équipes étaient recréées à chaque compétition
> (`wipeOperationalData`). C'est pourquoi `teams` **ne porte pas** de
> `competition_id` (contrairement à `series`/`matches`).

### 3.4 `series` — MODIFIÉE (+`competition_id` structurel)

Une série NBA Cup est une série **à 1 match**, `official_score_format = NULL`
(pas de best-of-7, pas de score de série à prédire — cf. mécanique Cup §2/§3).
Le modèle est donc unique pour Playoffs et Cup.

```sql
create table series (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id),   -- AJOUT (D2, structurel)
  round playoff_round not null,
  conference conference,                    -- NULL pour NBA_FINALS et pour la Cup
  slot_index int not null,                  -- position d'affichage stable (0.2.9)
  team1_id uuid references teams(id),
  team2_id uuid references teams(id),
  official_status series_status not null default 'SCHEDULED',
  official_winner_team_id uuid references teams(id),
  official_score_format series_format,      -- NULL pour la NBA Cup
  next_series_id uuid references series(id), -- cascade d'avancement (0.2.9) ; NULL en finale
  next_series_slot smallint check (next_series_slot in (1, 2)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Cible des FK composites qui garantissent la cohérence du competition_id
  -- dénormalisé sur matches/bracket_picks/bets (§4).
  unique (id, competition_id)
);

create index idx_series_competition on series (competition_id);
```

### 3.5 `matches` — MODIFIÉE (+`competition_id` dénormalisé, FK composite)

```sql
create table matches (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null,             -- AJOUT (D2, dénormalisé depuis series)
  series_id uuid not null,
  game_number smallint not null check (game_number between 1 and 7),
  scheduled_at timestamptz,                 -- NULL tant que la date n'est pas confirmée
  status match_status not null default 'SCHEDULED',
  home_team_id uuid references teams(id),
  away_team_id uuid references teams(id),
  -- SCORE FINAL = SOMME du tableau par quart-temps renvoyé par l'API (C-1 / A6).
  -- Ces colonnes stockent le TOTAL déjà sommé par lib/nba/client.ts, jamais une
  -- valeur brute de l'API.
  home_score int,
  away_score int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, game_number),
  unique (id, competition_id),              -- cible FK composite
  -- MODIFIÉ : le FK simple `series_id -> series(id)` du proto devient composite.
  -- Garantit au niveau DB : matches.competition_id = series.competition_id.
  foreign key (series_id, competition_id) references series (id, competition_id)
);

create index idx_matches_scheduled_at on matches (scheduled_at);
create index idx_matches_series_id    on matches (series_id);
create index idx_matches_competition  on matches (competition_id);   -- AJOUT
```

### 3.6 `entity_mappings` — REPRISE

```sql
create table entity_mappings (
  id uuid primary key default gen_random_uuid(),
  entity_type mapping_entity_type not null,
  internal_id uuid not null,                -- teams.id / series.id / matches.id selon entity_type
  source_type text not null,                -- V1 : 'HIGHLIGHTLY' (proto : 'SIMULATION')
  source_ref text not null,                 -- id Highlightly
  status mapping_status not null default 'PENDING',
  confirmed_by_admin_id uuid references users(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (entity_type, internal_id, source_type)
);
```

> Pas de `competition_id` : le `internal_id` résout déjà la compétition (via
> `series`/`matches`). Les mappings `TEAM` sont globaux et persistants (D6),
> comme la table `teams`. Frontière unique app ↔ ids Highlightly (P8) : une
> entité `PENDING` ne porte aucun scoring ni verrouillage.

### 3.7 `brackets` — MODIFIÉE (+`competition_id`, unicité re-scopée)

```sql
create table brackets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  competition_id uuid not null references competitions(id),   -- AJOUT (D2, structurel)
  is_validated boolean not null default false,       -- clic volontaire « Valider »
  validated_at timestamptz,
  is_auto_validated boolean not null default false,  -- rempli non cliqué à la deadline
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- MODIFIÉ : unique(user_id) -> unique(user_id, competition_id).
  -- 1 bracket par joueur ET PAR COMPÉTITION (D2). C'est la SEULE contrainte
  -- d'unicité réellement cassée par la rétention (cf. §9 point 2).
  unique (user_id, competition_id),
  unique (id, competition_id)                        -- cible FK composite
);

create index idx_brackets_competition on brackets (competition_id);   -- AJOUT
```

### 3.8 `bracket_picks` — MODIFIÉE (+`competition_id` dénormalisé, double FK composite, CHECK≥0)

```sql
create table bracket_picks (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null,             -- AJOUT (D2, dénormalisé)
  bracket_id uuid not null,
  series_id uuid not null,
  predicted_winner_team_id uuid references teams(id),
  predicted_score_format series_format,     -- NULL pour la NBA Cup (pas de score exact)
  -- NOTE app : predicted_winner_team_id doit valoir series.team1_id ou team2_id
  -- (non exprimable en CHECK simple ; vérifié en server action, T6).

  -- Scoring — 3 composantes cumulables (0.2.5 §7), écrites par le moteur idempotent.
  is_winner_correct boolean,
  is_score_exact boolean,
  is_matchup_correct boolean,               -- « affiche » : bonne paire au bon slot (A3)
  winner_points      int check (winner_points      >= 0),   -- CHECK AJOUTÉ (P6)
  exact_score_points int check (exact_score_points >= 0),   -- CHECK AJOUTÉ (P6)
  matchup_points     int check (matchup_points     >= 0),   -- CHECK AJOUTÉ (P6)
  points_awarded int generated always as (
    coalesce(winner_points,0) + coalesce(exact_score_points,0) + coalesce(matchup_points,0)
  ) stored,
  scored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bracket_id, series_id),
  -- DOUBLE FK composite : force pick.competition_id = bracket.competition_id
  -- ET = series.competition_id. Interdit structurellement de mêler un bracket
  -- d'une compétition à une série d'une autre (§4).
  foreign key (bracket_id, competition_id) references brackets (id, competition_id),
  foreign key (series_id,  competition_id) references series   (id, competition_id)
);

create index idx_bracket_picks_competition on bracket_picks (competition_id);   -- AJOUT
```

### 3.9 `match_predictions` — MODIFIÉE (+`competition_id` dénormalisé, FK composite, CHECK≥0)

```sql
create table match_predictions (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null,             -- AJOUT (D2, dénormalisé)
  user_id uuid not null references users(id),
  match_id uuid not null,
  predicted_winner_team_id uuid references teams(id),
  predicted_margin int check (predicted_margin between 1 and 50),
  status match_prediction_status not null default 'DRAFT',
  is_auto_validated boolean not null default false,
  validated_at timestamptz,

  -- Correction admin exceptionnelle (0.2.3 §7), sur requête, marquée publiquement.
  is_admin_corrected boolean not null default false,
  corrected_by_admin_id uuid references users(id),
  correction_request_id uuid,               -- FK ajoutée après correction_requests (§8)
  correction_reason text,

  -- Scoring (0.2.5 §2), écrit par le recalcul idempotent.
  is_winner_correct boolean,
  margin_diff int,                          -- |écart pronostiqué − écart réel|
  winner_points       int check (winner_points       >= 0),   -- CHECK AJOUTÉ (P6)
  margin_bonus_points int check (margin_bonus_points >= 0),   -- CHECK AJOUTÉ (P6)
  points_awarded int generated always as (
    coalesce(winner_points,0) + coalesce(margin_bonus_points,0)
  ) stored,
  scored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id),
  foreign key (match_id, competition_id) references matches (id, competition_id)   -- composite
);

create index idx_match_predictions_user        on match_predictions (user_id);
create index idx_match_predictions_match        on match_predictions (match_id);
create index idx_match_predictions_competition  on match_predictions (competition_id);   -- AJOUT
```

### 3.10 `bets` — MODIFIÉE (+`competition_id`, +catégorie, FK composites, CHECK≥0)

```sql
create table bets (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null,             -- AJOUT (D2, dénormalisé)
  user_id uuid not null references users(id),
  scope bet_scope not null,                 -- Cup : SERIES écarté fonctionnellement (garde app)
  series_id uuid not null,
  match_id uuid,                            -- NULL si scope=SERIES, requis si scope=MATCH
  description text not null,

  -- Catégorie (C3) : proposée par le joueur, validée/corrigée par l'admin au
  -- MÊME geste que la difficulté (mêmes colonnes proposed_/validated_).
  proposed_category  bet_category not null,        -- AJOUT (C3)
  validated_category bet_category,                 -- AJOUT (C3) ; NULL tant que non validé

  proposed_difficulty  smallint not null check (proposed_difficulty  between 1 and 5),
  validated_difficulty smallint          check (validated_difficulty between 1 and 5), -- fait foi (0.2.4 §7)
  status bet_status not null default 'DRAFT',
  is_auto_validated boolean not null default false,

  submitted_at timestamptz,
  validated_at timestamptz,
  resolved_at timestamptz,
  validated_by_admin_id uuid references users(id),
  resolved_by_admin_id  uuid references users(id),
  refusal_reason text,
  resolution_reason text,

  points_awarded int check (points_awarded >= 0),  -- CHECK AJOUTÉ (P6) ; barème 5/10/15/20/25
  scored_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Correction admin exceptionnelle (symétrie avec match_predictions).
  is_admin_corrected boolean not null default false,
  corrected_by_admin_id uuid references users(id),
  correction_request_id uuid,               -- FK ajoutée après correction_requests (§8)
  correction_reason text,

  constraint bet_match_scope_check check (
    (scope = 'MATCH'  and match_id is not null) or
    (scope = 'SERIES' and match_id is null)
  ),
  -- FK composites (cohérence competition_id). Celle sur match_id n'est PAS
  -- vérifiée quand match_id est NULL (comportement MATCH SIMPLE de Postgres),
  -- ce qui est correct pour un pari SERIES.
  foreign key (series_id, competition_id) references series  (id, competition_id),
  foreign key (match_id,  competition_id) references matches (id, competition_id)
);

create index idx_bets_user        on bets (user_id);
create index idx_bets_series       on bets (series_id);
create index idx_bets_competition  on bets (competition_id);   -- AJOUT

-- Quotas (0.2.4 §2). REPRIS SANS AJOUT DE competition_id (cf. §9 point 2) :
-- series_id et match_id sont déjà propres à une seule compétition, donc ces
-- unicités sont déjà correctement scopées par compétition.
create unique index uniq_active_series_bet
  on bets (user_id, series_id)
  where scope = 'SERIES' and status not in ('REJECTED', 'CANCELLED');

create unique index uniq_active_match_bet
  on bets (user_id, match_id)
  where scope = 'MATCH' and status <> 'REJECTED';

-- NOTE (inchangée) : « 3 paris MATCH max par joueur et par série, sur 3 matchs
-- différents » nécessite un COUNT → server action, pas une contrainte simple.
```

### 3.11 `correction_requests` — MODIFIÉE

```sql
create table correction_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references users(id),
  target_type correction_target_type not null,
  target_match_prediction_id uuid references match_predictions(id),
  target_bet_id uuid references bets(id),
  justification text not null,
  status correction_request_status not null default 'PENDING',
  admin_reason text,                        -- obligatoire si REJECTED (garde app)
  handled_by_admin_id uuid references users(id),   -- jamais l'auteur
  created_at timestamptz not null default now(),
  handled_at timestamptz,

  -- Valeurs proposées par le joueur selon target_type (NULL = repli sur la
  -- valeur actuelle, géré en app).
  proposed_winner_team_id uuid references teams(id),                        -- si MATCH_PREDICTION
  proposed_margin int check (proposed_margin between 1 and 50),             -- si MATCH_PREDICTION
  proposed_description text,                                                -- si BET
  proposed_difficulty smallint check (proposed_difficulty between 1 and 5), -- si BET
  -- AJOUT acté (18/07/2026) par symétrie avec proposed_difficulty : le joueur
  -- peut proposer une correction de CATÉGORIE via une requête, au même titre
  -- que la difficulté.
  proposed_category bet_category,                                           -- si BET

  constraint correction_target_consistency check (
    (target_type = 'MATCH_PREDICTION' and target_match_prediction_id is not null and target_bet_id is null) or
    (target_type = 'BET' and target_bet_id is not null and target_match_prediction_id is null)
  )
);

-- FKs circulaires ajoutées après coup (les 2 tables préexistent).
alter table match_predictions
  add constraint match_predictions_correction_request_fk
  foreign key (correction_request_id) references correction_requests(id);

alter table bets
  add constraint bets_correction_request_id_fkey
  foreign key (correction_request_id) references correction_requests(id);

-- Une seule requête PENDING à la fois par prono / par pari.
create unique index uniq_pending_correction_per_match_prediction
  on correction_requests (target_match_prediction_id)
  where status = 'PENDING' and target_match_prediction_id is not null;

create unique index uniq_pending_correction_per_bet
  on correction_requests (target_bet_id)
  where status = 'PENDING' and target_bet_id is not null;
```

### 3.12 `audit_logs` — REPRISE (inchangée)

C'est la table `admin_logs` évoquée en B2 (le maître §2 la nomme `audit_logs`).
Log interne, jamais public, sans purge auto (B2).

```sql
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id),  -- NULL si action système/synchro
  action text not null,
  target_type text not null,
  target_id uuid,
  reason text,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_target on audit_logs (target_type, target_id);
```

### 3.13 `sync_logs` — AJOUTÉE (B3)

```sql
create table sync_logs (
  id uuid primary key default gen_random_uuid(),
  sync_type sync_type not null,             -- TEAMS / SCHEDULE / RESULTS / HEARTBEAT
  competition_id uuid references competitions(id),  -- NULL pour TEAMS / HEARTBEAT (hors compétition)
  endpoint text,                            -- endpoint Highlightly appelé (NULL pour heartbeat)
  success boolean not null,                 -- succès / erreur (B3)
  summary text,                             -- résumé de la réponse (B3)
  -- Suivi de quota (acté) : header x-ratelimit-requests-remaining (A6, 100 req/jour),
  -- pour surveiller la consommation.
  requests_remaining int,
  created_at timestamptz not null default now()
);

create index idx_sync_logs_created on sync_logs (created_at desc);
create index idx_sync_logs_type    on sync_logs (sync_type);
```

### 3.14 `competition_archives` — REPRISE (inchangée)

Instantané figé du classement final à la clôture. Miroir des colonnes de
`user_scores` + rang + `pseudo_snapshot` (figé). Aucune correction après clôture.

```sql
create table competition_archives (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id),
  user_id uuid not null references users(id),
  pseudo_snapshot text not null,            -- figé (users.pseudo est mutable)
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

---

## 4. Cohérence du `competition_id` dénormalisé (D2) — acté

D2 impose `competition_id` sur `series` et `brackets` (structurel) et le
**dénormalise** sur `matches`, `bracket_picks`, `match_predictions`, `bets`
(policies et index plus simples qu'une jointure évaluée à chaque ligne), avec
un **mécanisme de cohérence à proposer**.

**Proposition retenue : clés étrangères composites**, plutôt qu'un trigger.

```text
Chaque table dénormalisée référence son parent sur (id, competition_id) :

  matches         (series_id,  competition_id) -> series (id, competition_id)
  bracket_picks   (bracket_id, competition_id) -> brackets (id, competition_id)
  bracket_picks   (series_id,  competition_id) -> series   (id, competition_id)
  match_predictions (match_id, competition_id) -> matches  (id, competition_id)
  bets            (series_id,  competition_id) -> series    (id, competition_id)
  bets            (match_id,   competition_id) -> matches   (id, competition_id)

Postgres GARANTIT alors que la valeur dénormalisée = celle du parent. Aucune
ligne incohérente n'est INSÉRABLE. Pas de trigger, pas de fenêtre de course,
pas de dépendance à un « chemin d'écriture unique » applicatif.
```

Bénéfices :

- **`bracket_picks` a une double FK** → interdit structurellement un pick de
  bracket Playoffs pointant une série NBA Cup (les deux `competition_id` doivent
  coïncider). C'est un invariant produit gratuit.
- Le `competition_id` d'une série/d'un match ne change jamais après création →
  aucun souci de cascade `ON UPDATE`.
- Coût : quelques index `unique (id, competition_id)` servant de cibles de FK
  (négligeable à cette échelle).

Alternative écartée (acté) : trigger `BEFORE INSERT/UPDATE` recopiant
`competition_id` depuis le parent. Fonctionne mais ajoute du code impératif là
où une contrainte déclarative suffit, et ne protège pas mieux. D2 laissait ce
mécanisme ouvert ; il est désormais tranché en faveur des FK composites.

---

## 5. Vues de classement (MODIFIÉES — grain par compétition + `security_invoker`)

Deux changements, tous deux imposés par des décisions du maître :

1. **`security_invoker = true` (D4)** — les vues appliquent les droits du
   LECTEUR, ne contournent jamais la RLS (C-5). Le proto ne le déclarait pas
   (défaut = droits du créateur, qui aurait rendu les policies inopérantes).
2. **Grain `(competition_id, user_id)` (conséquence de D2)** — les tables
   opérationnelles portent désormais plusieurs compétitions ; le classement de
   la compétition active doit sommer *ses* lignes seulement. Le proto sommait
   tout car une seule compétition existait à la fois.

```sql
-- Classement dérivé, jamais stocké (P7). Une ligne par (compétition, joueur)
-- ayant au moins une ligne de scoring dans l'une des 3 sources.
create view user_scores
with (security_invoker = true) as
with participants as (
  select competition_id, user_id from match_predictions
  union
  select competition_id, user_id from bets
  union
  select bp.competition_id, br.user_id
    from bracket_picks bp join brackets br on br.id = bp.bracket_id
)
select
  s.competition_id,
  s.user_id,
  coalesce(m.matches_points, 0)       as matches_points,
  coalesce(m.margin_bonus_points, 0)  as margin_bonus_points,   -- exposé à part (0.2.6)
  coalesce(b.bracket_points, 0)       as bracket_points,
  coalesce(p.bets_points, 0)          as bets_points,
  coalesce(m.matches_points, 0) + coalesce(b.bracket_points, 0) + coalesce(p.bets_points, 0)
                                      as total_points,
  coalesce(m.correct_match_winners, 0) as correct_match_winners, -- départage #2 (0.2.6 §3)
  coalesce(m.exact_margins, 0)         as exact_margins           -- départage #3
from participants s
left join (
  select competition_id, user_id,
    sum(points_awarded)      as matches_points,
    sum(margin_bonus_points) as margin_bonus_points,
    count(*) filter (where is_winner_correct) as correct_match_winners,
    count(*) filter (where margin_diff = 0)   as exact_margins
  from match_predictions
  group by competition_id, user_id
) m on m.competition_id = s.competition_id and m.user_id = s.user_id
left join (
  select bp.competition_id, br.user_id, sum(bp.points_awarded) as bracket_points
  from brackets br join bracket_picks bp on bp.bracket_id = br.id
  group by bp.competition_id, br.user_id
) b on b.competition_id = s.competition_id and b.user_id = s.user_id
left join (
  select competition_id, user_id, sum(points_awarded) as bets_points
  from bets
  group by competition_id, user_id
) p on p.competition_id = s.competition_id and p.user_id = s.user_id;

-- Forme récente : fenêtre glissante de 7 jours, par compétition (0.2.6 §5).
create view user_recent_form
with (security_invoker = true) as
select competition_id, user_id, sum(points_awarded) as recent_form_points
from (
  select competition_id, user_id, points_awarded, scored_at from match_predictions
  union all
  select bp.competition_id, br.user_id, bp.points_awarded, bp.scored_at
    from bracket_picks bp join brackets br on br.id = bp.bracket_id
  union all
  select competition_id, user_id, points_awarded, scored_at from bets
) all_scores
where scored_at >= now() - interval '7 days'
group by competition_id, user_id;
```

Conséquences d'usage (à traiter dans les écrans, T6 — pas ici) :

- **Classement de la compétition active** = `... where competition_id = <active>`.
- **Afficher tous les joueurs actifs**, y compris ceux à « - » (A1) : left join
  au niveau de l'écran contre la liste des joueurs actifs. La vue reste une pure
  dérivation (elle ne liste que les participants réels), pour ne pas mélanger
  logique d'affichage et invariant D4.
- **Ligues (BACKLOG)** = filtrer ces lignes par appartenance à un sous-groupe.
  Le grain par joueur garde la porte ouverte (§6.4).

---

## 6. Vérification des invariants (points de vigilance du maître)

### 6.1 Invariant D4 « tout point n'existe que sur une ligne déjà publique » — table par table

Vérification demandée par le maître (§7-D4 : « vérifier que l'invariant tient
table par table, le signaler si une table le casse »). La preuve formelle par
test est du ressort de T3 ; T1 certifie que **le modèle ne casse pas l'invariant** :

```text
match_predictions : points ≠ 0 uniquement après scoring, qui n'a lieu qu'une
  fois le MATCH terminé — donc après le coup d'envoi, donc après le verrou qui
  a rendu la ligne publique. Avant : DRAFT/VALIDATED, points_awarded = 0.   ✔

bracket_picks : points ≠ 0 uniquement à la résolution de la série — donc après
  la bracket_deadline qui a rendu les picks publics. Avant deadline : 0.      ✔

bets : points ≠ 0 uniquement à la résolution admin — donc après la deadline du
  pari qui l'a rendu public. Avant : DRAFT/SUBMITTED/VALIDATED, 0.            ✔
```

Aucune table ne casse l'invariant. Les colonnes `points_awarded` étant
`generated ... coalesce(...,0)`, une ligne non encore scorée vaut **0** et
n'affecte donc **aucune somme** de `user_scores`, qu'elle soit visible ou non
du lecteur — c'est précisément ce qui rend `security_invoker` sûr sans fausser
les totaux. **Réserve à porter en T3** : cette sûreté dépend des policies RLS
qui devront rendre publiques *toutes* les lignes déjà scorées (match terminé,
série résolue, pari résolu). Si une policy oubliait d'en rendre une publique,
le total du lecteur baisserait — c'est le signal d'alarme voulu, pas une
régression silencieuse.

### 6.2 Aucun point négatif (P6)

Durcissement V1 : `CHECK (col >= 0)` sur **toutes** les colonnes de points
composantes (`winner_points`, `margin_bonus_points`, `exact_score_points`,
`matchup_points`) et sur `bets.points_awarded`. Au proto, P6 n'était qu'une
convention respectée par le moteur ; en V1 la DB la fait respecter (« la
contrainte fait foi en dernier ressort »). Les totaux générés sont des sommes de
valeurs `coalesce`-ées non négatives → non négatifs par construction. Nouveau
vs proto, acté le 18/07/2026, strictement aligné sur P6.

### 6.3 Idempotence du recalcul (P5)

Le schéma la permet : les composantes de points sont des colonnes simples
réécrites **en entier** par le moteur à chaque passe (pas d'incrément), et les
totaux sont `generated` (recalculés, jamais accumulés). Rejouer le moteur n
fois produit le même état. La logique du moteur elle-même est en T5.

### 6.4 Non-fermeture du BACKLOG_V1 (§6.3 du maître)

```text
Ligues (vue filtrée)      : user_scores a un grain par (compétition, joueur) →
  une future vue « ligue » filtre ces lignes par appartenance. Le « classement =
  tous les joueurs » n'est PAS codé en dur. Rien construit.                   ✔
Classement all-time       : le grain par compétition permet une ré-agrégation
  sur competition_id (future vue). Garde-fou « barème stable sinon rang/points
  relatifs » (BACKLOG) NON tranché ici, comme demandé.                        ✔
Courbe d'évolution + page perso historique : DÉBLOQUÉES par la rétention D2
  (données opérationnelles conservées, competition_id + scored_at partout).
  Dérivables sans nouvelle table. Rien construit.                            ✔
```

---

## 7. DIFF EXPLICITE consolidé vs `schema_prototype.sql`

### 7.1 Repris à l'identique

`competitions` (+ `uniq_one_active_competition`), `entity_mappings`,
`audit_logs`, `competition_archives`, et tous les enums conservés (§2). Motif :
validés de bout en bout au proto, aucune raison de les toucher.

### 7.2 Modifié (avec pourquoi)

| Élément | Modification | Pourquoi |
|---|---|---|
| `users.id` | `default gen_random_uuid()` → `references auth.users(id) on delete cascade` | arbitrage D / D5 : policies `user_id = auth.uid()` sans jointure |
| `users.email` | **supprimée** | D5 : doublon d'auth.users ; la RLS filtre des lignes, la garder l'exposerait via `user_scores` |
| `users.is_primary_human` | **supprimée** | artefact proto (compte humain unique remplacé par l'auth réelle) |
| `users.bot_profile` | **supprimée** | artefact proto (plus de faux joueurs) |
| `users.theme_preference` | **ajoutée** | 0.2.9 §2 |
| `teams` | sémantique : globale et persistante | D6 (référentiel des 30 équipes synchronisé une fois) |
| `series.competition_id` | **ajoutée** (NOT NULL) + `unique(id, competition_id)` | D2 (structurel) + cible FK composite |
| `matches.competition_id` | **ajoutée** (dénormalisée), FK simple → FK composite | D2 + cohérence (§4) |
| `brackets` | `unique(user_id)` → `unique(user_id, competition_id)`, +`competition_id`, +`unique(id, competition_id)` | D2 (seule unicité réellement cassée) |
| `bracket_picks` | +`competition_id`, double FK composite, +CHECK≥0 | D2 + cohérence + P6 |
| `match_predictions` | +`competition_id`, FK composite, +CHECK≥0 | D2 + cohérence + P6 |
| `bets` | +`competition_id`, +`proposed_category`/`validated_category`, FK composites, +CHECK≥0 | D2 + C3 + cohérence + P6 |
| `correction_requests` | +`proposed_category` | symétrie C3 |
| `teams` | +`unique(abbreviation)` | garde-fou anti-doublon du référentiel (D6) |
| `user_scores` | grain `(competition_id, user_id)` + `security_invoker = true` | D2 + D4 |
| `user_recent_form` | grain `(competition_id, user_id)` + `security_invoker = true` | D2 + D4 |

### 7.3 Ajouté

| Élément | Pourquoi |
|---|---|
| enum `theme_preference` | 0.2.9 §2 |
| enum `bet_category` (9 valeurs) | C3 |
| enum `sync_type` | structuration `sync_logs` |
| table `sync_logs` | B3 |
| index `idx_*_competition` sur series/matches/brackets/bracket_picks/match_predictions/bets | filtrage + RLS par compétition (D2) |

### 7.4 Supprimé

| Élément | Pourquoi |
|---|---|
| table `simulation_state` | artefact proto (remplacé par vraie API + planificateur externe) |
| enum `bot_profile` | plus de faux joueurs scriptés |
| enum `simulation_mode` | n'était utilisé que par `simulation_state` |
| enum `simulation_granularity` | idem |

---

## 8. Ordre de la migration initiale

Migration versionnée unique dans `supabase/migrations/<timestamp>_initial_schema.sql`
(P15), produite **après validation de T1**. Ordre imposé par les FK :

```text
1.  extension pgcrypto
2.  enums (§2)
3.  teams
4.  users            (FK inline vers teams ; PK vers auth.users)
5.  competitions
6.  series           (FK vers competitions, teams, self)
7.  matches          (FK composite vers series)
8.  entity_mappings
9.  brackets         (FK vers users, competitions)
10. bracket_picks    (double FK composite vers brackets, series)
11. match_predictions(FK composite vers matches)
12. bets             (FK composites vers series, matches)
13. correction_requests + alter des FK circulaires sur match_predictions/bets
                      + index uniq_pending_correction_*
14. audit_logs
15. sync_logs
16. competition_archives
17. vues user_scores, user_recent_form
```

Hors de cette migration : le **seed du 1er admin** (A4) — seed manuel unique,
après inscription du 1er compte, traité en T2. Les **RLS** — T3.

---

## 9. Décisions actées à la validation de T1 (18/07/2026)

Les 7 points ouverts à la rédaction sont tranchés. Ils ont désormais le même
statut non rouvrable que les décisions du maître (§7 D1-D6).

```text
1. Cohérence competition_id = FK COMPOSITES (§4), pas trigger. Tranché en faveur
   des composites : déclaratif, garanti au niveau DB, aucune fenêtre de course.
   Résout le seul mécanisme que D2 laissait ouvert.

2. Index de quotas de paris : PAS de competition_id ajouté à
   uniq_active_series_bet / uniq_active_match_bet. Analyse confirmée : series_id
   et match_id sont déjà propres à une seule compétition, donc ces unicités sont
   déjà correctement scopées. La SEULE unicité réellement cassée par la rétention
   est brackets(user_id) -> (user_id, competition_id), corrigée.

3. Durcissement P6 : CHECK (points >= 0) sur toutes les colonnes de points.
   Retenu — P6 passe d'une convention à un invariant garanti par la DB.

4. sync_logs : enum sync_type (TEAMS/SCHEDULE/RESULTS/HEARTBEAT) + colonne
   requests_remaining (suivi du quota 100/j). Retenus en plus du strict B3.

5. bet_category : libellés d'enum EN retenus tels quels (mapping aux 9 catégories
   FR de C3, §2).

6. correction_requests.proposed_category : retenu, par symétrie avec
   proposed_difficulty (le joueur peut proposer une correction de catégorie).

7. teams : unique(abbreviation) retenu comme garde-fou anti-doublon du
   référentiel (D6).
```

**T1 est VALIDÉ et figé.** Prochaine étape logique : la migration initiale (§8),
qui ne partira en `db push` qu'après feu vert explicite (jamais silencieusement).
Puis, dans l'ordre de construction du maître (§6) : **T2 (Auth)** avant **T3 (RLS)**.
```
