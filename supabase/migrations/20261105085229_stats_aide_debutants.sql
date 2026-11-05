-- Aide aux debutants (Cadrage/Suivi/chantiers/CHANTIER_AIDE_DEBUTANTS.md, lot 1) :
-- forme des equipes et stats de saison des joueurs, PRE-CALCULEES apres chaque
-- import de box scores (decision D4). Les etiquettes (En feu, En hausse...)
-- sont calculees cote TypeScript a partir de ces chiffres bruts (D5).
--
-- Lecture uniquement via le client service cote serveur : RLS activee sans
-- policy, comme les autres tables stats_*.

create index stats_box_scores_season_idx on stats_box_scores (season);

create table stats_team_form (
  season text not null,
  team_id integer not null references stats_equipes (team_id),
  tricode text not null,
  conference conference,
  games_played integer not null,
  wins integer not null,
  losses integer not null,
  home_wins integer not null,
  home_losses integer not null,
  away_wins integer not null,
  away_losses integer not null,
  pts_for_avg numeric(5,1),
  pts_against_avg numeric(5,1),
  point_diff_avg numeric(5,1),
  last5_results text not null,
  last5_wins integer not null,
  last5_point_diff_avg numeric(5,1),
  streak_type char(1) not null,
  streak_length integer not null,
  conference_rank integer,
  last_game_date date not null,
  computed_at timestamptz not null default now(),
  primary key (season, team_id)
);

create table stats_player_season (
  season text not null,
  player_id integer not null references stats_joueurs (player_id),
  first_name text not null,
  family_name text not null,
  current_team_id integer not null references stats_equipes (team_id),
  games_played integer not null,
  games_with_current_team integer not null,
  games_started integer not null,
  minutes_avg numeric(4,1),
  pts_avg numeric(4,1),
  reb_avg numeric(4,1),
  ast_avg numeric(4,1),
  stl_avg numeric(4,1),
  blk_avg numeric(4,1),
  tov_avg numeric(4,1),
  fg3m_avg numeric(4,1),
  fgm integer,
  fga integer,
  fg3a integer,
  ftm integer,
  fta integer,
  fg_pct numeric(4,3),
  fg3_pct numeric(4,3),
  ft_pct numeric(4,3),
  ts_pct numeric(4,3),
  last5_games integer not null,
  last5_minutes_avg numeric(4,1),
  last5_pts_avg numeric(4,1),
  last5_reb_avg numeric(4,1),
  last5_ast_avg numeric(4,1),
  last_game_date date not null,
  computed_at timestamptz not null default now(),
  primary key (season, player_id)
);

create index stats_player_season_team_idx
  on stats_player_season (season, current_team_id);

alter table stats_team_form enable row level security;
alter table stats_player_season enable row level security;

create or replace function public.refresh_stats_aide_debutants(p_season text default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_season text := p_season;
  v_start timestamptz := clock_timestamp();
  v_teams integer;
  v_players integer;
begin
  -- Saison la plus recente ayant au moins un match de saison reguliere.
  if v_season is null then
    select max(season) into v_season
    from stats_matchs
    where season_type = 'Regular Season';
  end if;

  if v_season is null then
    return jsonb_build_object('season', null, 'teams', 0, 'players', 0, 'duration_ms', 0);
  end if;

  delete from stats_team_form where season = v_season;
  delete from stats_player_season where season = v_season;

  -- ---------------------------------------------------------------- equipes
  with reg_games as (
    select game_id, game_date, home_team_id, away_team_id
    from stats_matchs
    where season = v_season and season_type = 'Regular Season'
  ),
  team_scores as (
    select b.game_id, b.team_id, sum(b.pts)::integer as pts
    from stats_box_scores b
    join reg_games g on g.game_id = b.game_id
    where b.team_id is not null
    group by b.game_id, b.team_id
  ),
  team_games as (
    select
      t.team_id,
      g.game_id,
      g.game_date,
      (t.team_id = g.home_team_id) as is_home,
      t.pts as pts_for,
      o.pts as pts_against,
      (t.pts > o.pts) as won
    from team_scores t
    join reg_games g on g.game_id = t.game_id
    join team_scores o on o.game_id = t.game_id and o.team_id <> t.team_id
  ),
  ranked as (
    select tg.*,
      row_number() over (partition by team_id order by game_date desc, game_id desc) as rn,
      first_value(won) over (partition by team_id order by game_date desc, game_id desc) as latest_won
    from team_games tg
  ),
  agg as (
    select
      team_id,
      count(*)::integer as games_played,
      count(*) filter (where won)::integer as wins,
      count(*) filter (where not won)::integer as losses,
      count(*) filter (where won and is_home)::integer as home_wins,
      count(*) filter (where not won and is_home)::integer as home_losses,
      count(*) filter (where won and not is_home)::integer as away_wins,
      count(*) filter (where not won and not is_home)::integer as away_losses,
      avg(pts_for) as pts_for_avg,
      avg(pts_against) as pts_against_avg,
      avg(pts_for - pts_against) as point_diff_avg,
      string_agg(case when won then 'V' else 'D' end, '' order by rn) filter (where rn <= 5) as last5_results,
      count(*) filter (where rn <= 5 and won)::integer as last5_wins,
      avg(pts_for - pts_against) filter (where rn <= 5) as last5_point_diff_avg,
      max(game_date) as last_game_date,
      -- serie en cours : le dernier resultat, repete tant qu'il ne change pas
      bool_or(won) filter (where rn = 1) as last_won,
      min(rn) filter (where won <> latest_won) as first_break
    from ranked
    group by team_id
  ),
  with_conf as (
    select
      a.*,
      e.tricode,
      t.conference
    from agg a
    join stats_equipes e on e.team_id = a.team_id
    left join teams t on t.abbreviation = e.tricode
  ),
  with_rank as (
    select
      c.*,
      case when c.conference is null then null else
        rank() over (
          partition by c.conference
          order by (c.wins::numeric / c.games_played) desc,
                   c.point_diff_avg desc,
                   c.tricode
        )
      end as conference_rank
    from with_conf c
  )
  insert into stats_team_form (
    season, team_id, tricode, conference, games_played, wins, losses,
    home_wins, home_losses, away_wins, away_losses,
    pts_for_avg, pts_against_avg, point_diff_avg,
    last5_results, last5_wins, last5_point_diff_avg,
    streak_type, streak_length, conference_rank, last_game_date
  )
  select
    v_season, team_id, tricode, conference, games_played, wins, losses,
    home_wins, home_losses, away_wins, away_losses,
    pts_for_avg, pts_against_avg, point_diff_avg,
    last5_results, last5_wins, last5_point_diff_avg,
    case when last_won then 'V' else 'D' end,
    coalesce(first_break - 1, games_played),
    conference_rank, last_game_date
  from with_rank;

  get diagnostics v_teams = row_count;

  -- ---------------------------------------------------------------- joueurs
  with reg_games as (
    select game_id, game_date
    from stats_matchs
    where season = v_season and season_type = 'Regular Season'
  ),
  lines as (
    select
      b.player_id, b.team_id, b.game_id, g.game_date,
      b.position, b.pts, b.reb, b.ast, b.stl, b.blk, b.tov,
      b.fg3m, b.fg3a, b.fgm, b.fga, b.ftm, b.fta,
      case when b.minutes ~ '^\d+:\d{2}$'
        then split_part(b.minutes, ':', 1)::int + split_part(b.minutes, ':', 2)::int / 60.0
      end as min_dec
    from stats_box_scores b
    join reg_games g on g.game_id = b.game_id
    where b.team_id is not null
  ),
  ranked as (
    select l.*,
      row_number() over (partition by player_id order by game_date desc, game_id desc) as rn
    from lines l
  ),
  cur as (
    select player_id, team_id as current_team_id from ranked where rn = 1
  ),
  agg as (
    select
      r.player_id,
      c.current_team_id,
      count(*)::integer as games_played,
      count(*) filter (where r.team_id = c.current_team_id)::integer as games_with_current_team,
      count(*) filter (where coalesce(r.position, '') <> '')::integer as games_started,
      avg(r.min_dec) as minutes_avg,
      avg(r.pts) as pts_avg, avg(r.reb) as reb_avg, avg(r.ast) as ast_avg,
      avg(r.stl) as stl_avg, avg(r.blk) as blk_avg, avg(r.tov) as tov_avg,
      avg(r.fg3m) as fg3m_avg,
      sum(r.fgm)::integer as fgm, sum(r.fga)::integer as fga,
      sum(r.fg3m)::integer as fg3m, sum(r.fg3a)::integer as fg3a,
      sum(r.ftm)::integer as ftm, sum(r.fta)::integer as fta,
      sum(r.pts) as pts_total,
      count(*) filter (where r.rn <= 5)::integer as last5_games,
      avg(r.min_dec) filter (where r.rn <= 5) as last5_minutes_avg,
      avg(r.pts) filter (where r.rn <= 5) as last5_pts_avg,
      avg(r.reb) filter (where r.rn <= 5) as last5_reb_avg,
      avg(r.ast) filter (where r.rn <= 5) as last5_ast_avg,
      max(r.game_date) as last_game_date
    from ranked r
    join cur c on c.player_id = r.player_id
    group by r.player_id, c.current_team_id
  )
  insert into stats_player_season (
    season, player_id, first_name, family_name, current_team_id,
    games_played, games_with_current_team, games_started, minutes_avg,
    pts_avg, reb_avg, ast_avg, stl_avg, blk_avg, tov_avg, fg3m_avg,
    fgm, fga, fg3a, ftm, fta,
    fg_pct, fg3_pct, ft_pct, ts_pct,
    last5_games, last5_minutes_avg, last5_pts_avg, last5_reb_avg, last5_ast_avg,
    last_game_date
  )
  select
    v_season, a.player_id, j.first_name, j.family_name, a.current_team_id,
    a.games_played, a.games_with_current_team, a.games_started, a.minutes_avg,
    a.pts_avg, a.reb_avg, a.ast_avg, a.stl_avg, a.blk_avg, a.tov_avg, a.fg3m_avg,
    a.fgm, a.fga, a.fg3a, a.ftm, a.fta,
    a.fgm::numeric / nullif(a.fga, 0),
    a.fg3m::numeric / nullif(a.fg3a, 0),
    a.ftm::numeric / nullif(a.fta, 0),
    a.pts_total / nullif(2 * (a.fga + 0.44 * a.fta), 0),
    a.last5_games, a.last5_minutes_avg, a.last5_pts_avg, a.last5_reb_avg, a.last5_ast_avg,
    a.last_game_date
  from agg a
  join stats_joueurs j on j.player_id = a.player_id;

  get diagnostics v_players = row_count;

  return jsonb_build_object(
    'season', v_season,
    'teams', v_teams,
    'players', v_players,
    'duration_ms', round(extract(epoch from clock_timestamp() - v_start) * 1000)
  );
end;
$$;

-- Une fonction Postgres est executable par PUBLIC par defaut.
revoke execute on function public.refresh_stats_aide_debutants(text) from public, anon, authenticated;
grant execute on function public.refresh_stats_aide_debutants(text) to service_role;

-- Premier remplissage.
select public.refresh_stats_aide_debutants();
