-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION INITIALE (schéma)
-- ============================================================================
-- Fichier   : supabase/migrations/20260718090000_initial_schema.sql
-- Nature    : migration #1 du dépôt neuf (D1). Transcription FIDÈLE de
--             SPEC_TECHNIQUE_MODELE_DONNEES_V0.1.md (T1, validé le 18/07/2026),
--             dans l'ordre imposé par T1 §8.
-- Périmètre : SCHÉMA SEUL. Ne contient PAS :
--             - les policies RLS ni is_admin()          -> migration T3
--             - le trigger auth.users -> public.users    -> migration T2
--             - le seed du 1er admin (A4)                -> migration T2
-- Conventions : identifiants en anglais, commentaires en français (P11).
-- Postgres 15+ requis (security_invoker sur les vues, D4).
-- ============================================================================

-- ── 1. Extension ────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;

-- ── 2. Types énumérés ───────────────────────────────────────────────────────

-- Repris à l'identique du proto (validés).
create type competition_type   as enum ('PLAYOFFS', 'NBA_CUP');
create type competition_status as enum ('ACTIVE', 'ARCHIVED');
create type user_role   as enum ('PLAYER', 'ADMIN');
create type user_status as enum ('ACTIVE', 'DISABLED');            -- PENDING écarté (B1)
create type conference  as enum ('EAST', 'WEST');
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

-- Ajoutés en V1.
create type theme_preference as enum ('LIGHT', 'DARK');           -- 0.2.9 §2, sombre par défaut
create type bet_category as enum (                                -- C3, 9 catégories fixes
  'PLAYER_PROP',        -- Pari joueur
  'SCORE_TOTAL',        -- Score / total match
  'TEAM_PROP',          -- Pari équipe
  'PERIOD',             -- Pari période
  'HEAD_TO_HEAD',       -- Comparaison / duel
  'PLAYING_TIME',       -- Rotation / temps de jeu
  'MULTI_PLAYER_COMBO', -- Combo multi-joueurs
  'GAME_EVENT',         -- Événement de match
  'FUN_OFF_COURT'       -- Fun / hors terrain
);
create type sync_type as enum ('TEAMS', 'SCHEDULE', 'RESULTS', 'HEARTBEAT');   -- B3 / A8

-- ── 3. teams (référentiel global et persistant, D6) ─────────────────────────
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  abbreviation text not null,
  conference conference not null,
  logo_url text,                            -- URL native Highlightly (B4)
  created_at timestamptz not null default now(),
  unique (abbreviation)                     -- garde-fou anti-doublon du référentiel
);

-- ── 4. users (PK = auth.users.id, sans email, +thème — D5/arbitrage D) ──────
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  pseudo text not null unique,              -- identité publique (C4)
  avatar_url text,
  favorite_team_id uuid references teams(id),
  bio text,
  role user_role not null default 'PLAYER',
  status user_status not null default 'ACTIVE',
  theme_preference theme_preference not null default 'DARK',   -- 0.2.9 §2
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 5. competitions ─────────────────────────────────────────────────────────
create table competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type competition_type not null,
  status competition_status not null default 'ACTIVE',
  bracket_deadline timestamptz,             -- heure du 1er match du tour feuille
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Une seule compétition ACTIVE à la fois.
create unique index uniq_one_active_competition
  on competitions (status) where status = 'ACTIVE';

-- ── 6. series (+competition_id structurel) ──────────────────────────────────
create table series (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id),
  round playoff_round not null,
  conference conference,                     -- NULL pour NBA_FINALS et pour la Cup
  slot_index int not null,
  team1_id uuid references teams(id),
  team2_id uuid references teams(id),
  official_status series_status not null default 'SCHEDULED',
  official_winner_team_id uuid references teams(id),
  official_score_format series_format,       -- NULL pour la NBA Cup
  next_series_id uuid references series(id),  -- cascade d'avancement ; NULL en finale
  next_series_slot smallint check (next_series_slot in (1, 2)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, competition_id)                -- cible des FK composites (cohérence D2)
);

create index idx_series_competition on series (competition_id);

-- ── 7. matches (+competition_id dénormalisé, FK composite) ──────────────────
create table matches (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null,
  series_id uuid not null,
  game_number smallint not null check (game_number between 1 and 7),
  scheduled_at timestamptz,                  -- NULL tant que la date n'est pas confirmée
  status match_status not null default 'SCHEDULED',
  home_team_id uuid references teams(id),
  away_team_id uuid references teams(id),
  home_score int,                            -- SOMME du tableau par quart-temps (C-1/A6)
  away_score int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, game_number),
  unique (id, competition_id),               -- cible FK composite
  foreign key (series_id, competition_id) references series (id, competition_id)
);

create index idx_matches_scheduled_at on matches (scheduled_at);
create index idx_matches_series_id    on matches (series_id);
create index idx_matches_competition  on matches (competition_id);

-- ── 8. entity_mappings (frontière app <-> ids Highlightly, P8) ──────────────
create table entity_mappings (
  id uuid primary key default gen_random_uuid(),
  entity_type mapping_entity_type not null,
  internal_id uuid not null,                 -- teams.id / series.id / matches.id selon type
  source_type text not null,                 -- V1 : 'HIGHLIGHTLY'
  source_ref text not null,
  status mapping_status not null default 'PENDING',
  confirmed_by_admin_id uuid references users(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (entity_type, internal_id, source_type)
);

-- ── 9. brackets (+competition_id, unicité re-scopée) ────────────────────────
create table brackets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  competition_id uuid not null references competitions(id),
  is_validated boolean not null default false,        -- clic volontaire « Valider »
  validated_at timestamptz,
  is_auto_validated boolean not null default false,   -- rempli non cliqué à la deadline
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, competition_id),          -- 1 bracket / joueur / compétition (D2)
  unique (id, competition_id)                -- cible FK composite
);

create index idx_brackets_competition on brackets (competition_id);

-- ── 10. bracket_picks (+competition_id, double FK composite, CHECK>=0) ──────
create table bracket_picks (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null,
  bracket_id uuid not null,
  series_id uuid not null,
  predicted_winner_team_id uuid references teams(id),
  predicted_score_format series_format,      -- NULL pour la NBA Cup (pas de score exact)

  -- Scoring — 3 composantes cumulables (0.2.5 §7), écrites par le moteur idempotent.
  is_winner_correct boolean,
  is_score_exact boolean,
  is_matchup_correct boolean,                -- « affiche » (A3)
  winner_points      int check (winner_points      >= 0),   -- P6
  exact_score_points int check (exact_score_points >= 0),   -- P6
  matchup_points     int check (matchup_points     >= 0),   -- P6
  points_awarded int generated always as (
    coalesce(winner_points,0) + coalesce(exact_score_points,0) + coalesce(matchup_points,0)
  ) stored,
  scored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bracket_id, series_id),
  -- Double FK composite : force pick.competition_id = bracket = series.
  foreign key (bracket_id, competition_id) references brackets (id, competition_id),
  foreign key (series_id,  competition_id) references series   (id, competition_id)
);

create index idx_bracket_picks_competition on bracket_picks (competition_id);

-- ── 11. match_predictions (+competition_id, FK composite, CHECK>=0) ─────────
create table match_predictions (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null,
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
  correction_request_id uuid,                -- FK ajoutée plus bas (circulaire)
  correction_reason text,

  -- Scoring (0.2.5 §2), écrit par le recalcul idempotent.
  is_winner_correct boolean,
  margin_diff int,                           -- |écart pronostiqué − écart réel|
  winner_points       int check (winner_points       >= 0),   -- P6
  margin_bonus_points int check (margin_bonus_points >= 0),   -- P6
  points_awarded int generated always as (
    coalesce(winner_points,0) + coalesce(margin_bonus_points,0)
  ) stored,
  scored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id),
  foreign key (match_id, competition_id) references matches (id, competition_id)
);

create index idx_match_predictions_user       on match_predictions (user_id);
create index idx_match_predictions_match       on match_predictions (match_id);
create index idx_match_predictions_competition on match_predictions (competition_id);

-- ── 12. bets (+competition_id, +catégorie, FK composites, CHECK>=0) ─────────
create table bets (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null,
  user_id uuid not null references users(id),
  scope bet_scope not null,                  -- Cup : SERIES écarté fonctionnellement (garde app)
  series_id uuid not null,
  match_id uuid,                             -- NULL si SERIES, requis si MATCH
  description text not null,

  -- Catégorie (C3) : proposée par le joueur, validée/corrigée par l'admin.
  proposed_category  bet_category not null,
  validated_category bet_category,           -- NULL tant que non validé

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

  points_awarded int check (points_awarded >= 0),   -- P6 ; barème 5/10/15/20/25
  scored_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Correction admin exceptionnelle (symétrie avec match_predictions).
  is_admin_corrected boolean not null default false,
  corrected_by_admin_id uuid references users(id),
  correction_request_id uuid,                -- FK ajoutée plus bas (circulaire)
  correction_reason text,

  constraint bet_match_scope_check check (
    (scope = 'MATCH'  and match_id is not null) or
    (scope = 'SERIES' and match_id is null)
  ),
  -- FK composites (cohérence D2). Celle sur match_id n'est pas vérifiée quand
  -- match_id est NULL (MATCH SIMPLE), ce qui est correct pour un pari SERIES.
  foreign key (series_id, competition_id) references series  (id, competition_id),
  foreign key (match_id,  competition_id) references matches (id, competition_id)
);

create index idx_bets_user       on bets (user_id);
create index idx_bets_series      on bets (series_id);
create index idx_bets_competition on bets (competition_id);

-- Quotas (0.2.4 §2). series_id / match_id sont déjà propres à une compétition :
-- ces unicités sont donc déjà correctement scopées, pas de competition_id ajouté.
create unique index uniq_active_series_bet
  on bets (user_id, series_id)
  where scope = 'SERIES' and status not in ('REJECTED', 'CANCELLED');

create unique index uniq_active_match_bet
  on bets (user_id, match_id)
  where scope = 'MATCH' and status <> 'REJECTED';

-- ── 13. correction_requests (+proposed_category) + FKs circulaires ──────────
create table correction_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references users(id),
  target_type correction_target_type not null,
  target_match_prediction_id uuid references match_predictions(id),
  target_bet_id uuid references bets(id),
  justification text not null,
  status correction_request_status not null default 'PENDING',
  admin_reason text,                         -- obligatoire si REJECTED (garde app)
  handled_by_admin_id uuid references users(id),   -- jamais l'auteur
  created_at timestamptz not null default now(),
  handled_at timestamptz,

  -- Valeurs proposées selon target_type (NULL = repli sur la valeur actuelle, app).
  proposed_winner_team_id uuid references teams(id),                        -- si MATCH_PREDICTION
  proposed_margin int check (proposed_margin between 1 and 50),             -- si MATCH_PREDICTION
  proposed_description text,                                                -- si BET
  proposed_difficulty smallint check (proposed_difficulty between 1 and 5), -- si BET
  proposed_category bet_category,                                           -- si BET (symétrie C3)

  constraint correction_target_consistency check (
    (target_type = 'MATCH_PREDICTION' and target_match_prediction_id is not null and target_bet_id is null) or
    (target_type = 'BET' and target_bet_id is not null and target_match_prediction_id is null)
  )
);

-- FKs circulaires (les 2 tables préexistent).
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

-- ── 14. audit_logs (= admin_logs de B2 ; jamais public) ─────────────────────
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id),   -- NULL si action système/synchro
  action text not null,
  target_type text not null,
  target_id uuid,
  reason text,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_target on audit_logs (target_type, target_id);

-- ── 15. sync_logs (B3) ──────────────────────────────────────────────────────
create table sync_logs (
  id uuid primary key default gen_random_uuid(),
  sync_type sync_type not null,              -- TEAMS / SCHEDULE / RESULTS / HEARTBEAT
  competition_id uuid references competitions(id),  -- NULL pour TEAMS / HEARTBEAT
  endpoint text,                             -- endpoint Highlightly (NULL pour heartbeat)
  success boolean not null,
  summary text,                              -- résumé de la réponse (B3)
  requests_remaining int,                    -- x-ratelimit-requests-remaining (A6)
  created_at timestamptz not null default now()
);

create index idx_sync_logs_created on sync_logs (created_at desc);
create index idx_sync_logs_type    on sync_logs (sync_type);

-- ── 16. competition_archives (snapshot figé à la clôture) ───────────────────
create table competition_archives (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id),
  user_id uuid not null references users(id),
  pseudo_snapshot text not null,             -- figé (users.pseudo est mutable)
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

-- ── 17. Vues de classement (grain par compétition, security_invoker — D4) ───
-- Une ligne par (compétition, joueur) ayant au moins une ligne de scoring.
-- L'affichage « tous les joueurs actifs, y compris à - » est un left join au
-- niveau écran (T6), pas dans la vue (elle reste une pure dérivation).
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
  coalesce(m.matches_points, 0)        as matches_points,
  coalesce(m.margin_bonus_points, 0)   as margin_bonus_points,   -- exposé à part (0.2.6)
  coalesce(b.bracket_points, 0)        as bracket_points,
  coalesce(p.bets_points, 0)           as bets_points,
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

-- ============================================================================
-- FIN — migration #1. RLS (T3), trigger auth + seed admin (T2) : migrations à venir.
-- ============================================================================
