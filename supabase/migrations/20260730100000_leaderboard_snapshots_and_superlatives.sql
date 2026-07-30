-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #18 — SNAPSHOTS DE CLASSEMENT + SUPERLATIFS
-- ============================================================================
-- Fichier   : supabase/migrations/20260730100000_leaderboard_snapshots_and_superlatives.sql
-- Motif     : BACKLOG_V1.md « Fun / esprit ligue entre potes » (superlatifs de
--             fin de compétition, badges/titres honorifiques). Un des titres
--             visés ("plus grosse remontée au classement") est INCALCULABLE
--             sans historique de classement dans le temps — décidé AVEC
--             l'utilisateur (30/07/2026) de construire d'abord ce socle
--             plutôt que d'abandonner ce titre. Sert aussi de fondation au
--             futur point "Historique & stats — courbe d'évolution", non
--             construit dans cette session (juste l'infra de collecte).
--
-- 2 tables neuves, rien d'existant modifié.
--
-- 1. leaderboard_snapshots : un instantané par (compétition, joueur, jour) —
--    fréquence confirmée AVEC l'utilisateur : 1x/jour (cron GitHub Actions,
--    même patron que les rappels push), suffisant pour une remontée/courbe,
--    sans accumuler une ligne par recalcul de score. RLS `using (true)` :
--    même classe d'info que `user_scores`/`competition_archives`
--    (agrégats de points/rang, jamais une ligne individuelle) — déjà
--    universellement visible (migration #5). Écrit UNIQUEMENT par le cron
--    (service_role) — aucune policy insert/update/delete pour les joueurs.
--
-- 2. competition_superlatives : titres FIGÉS à la clôture d'une compétition
--    (`closeCompetition`, lib/actions/admin-competitions.ts), même patron
--    que `competition_archives` (insert = is_admin(), session admin normale,
--    pas service_role — écrit dans la MÊME transaction logique que
--    l'archive). Plusieurs lignes possibles par (compétition, kind) : les
--    ex-aequo sont TOUS crédités, aucun tie-break arbitraire inventé.
-- ============================================================================

-- ── 1. leaderboard_snapshots ─────────────────────────────────────────────────

create table leaderboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id),
  user_id uuid not null references users(id),
  rank int not null,
  total_points int not null,
  snapshot_date date not null,
  created_at timestamptz not null default now(),
  unique (competition_id, user_id, snapshot_date)
);

create index idx_leaderboard_snapshots_competition on leaderboard_snapshots (competition_id);

alter table leaderboard_snapshots enable row level security;

create policy leaderboard_snapshots_select on leaderboard_snapshots for select using (true);

-- ── 2. competition_superlatives ──────────────────────────────────────────────

create type superlative_kind as enum (
  'NOSTRADAMUS',    -- le plus de bons vainqueurs de match (correct_match_winners)
  'SNIPER',         -- le plus d'écarts exacts (exact_margins)
  'BRACKET_KING',   -- le plus de points bracket (bracket_points)
  'BEST_ROUND1',    -- le plus de points gagnés sur les matchs du 1er tour
  'BIGGEST_CLIMB'   -- plus forte progression de rang entre le 1er snapshot et la clôture
);

create table competition_superlatives (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id),
  kind superlative_kind not null,
  user_id uuid not null references users(id),
  pseudo_snapshot text not null,   -- figé, même raison que competition_archives.pseudo_snapshot
  value int not null,              -- sens selon `kind` : un compte, des points, ou un delta de rang
  created_at timestamptz not null default now()
);

create index idx_competition_superlatives_competition on competition_superlatives (competition_id);

alter table competition_superlatives enable row level security;

create policy competition_superlatives_select on competition_superlatives for select using (true);
create policy competition_superlatives_insert on competition_superlatives for insert with check (public.is_admin());

-- ============================================================================
-- FIN — migration #18.
-- Vérif post-push : cron /api/snapshots/leaderboard écrit bien une ligne par
-- joueur scoré de la compétition active, upsert sur un 2e appel le même
-- jour (pas de doublon) ; closeCompetition() insère des lignes
-- competition_superlatives cohérentes avec competition_archives.
-- ============================================================================
