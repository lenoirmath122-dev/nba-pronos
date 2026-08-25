-- Chantier "événements granulaires" (étape 6 du plan de reprise post-audit,
-- GAPS_OUVERTS.md, 25/08/2026) -- buzzer beater ("aucun panier marqué au
-- buzzer"/"dernier panier du match") et contre SUR un joueur précis. Données
-- déjà présentes dans le play-by-play (local pour l'historique, PlayByPlayV3
-- déjà appelé quotidiennement depuis l'étape 5 pour le quotidien -- aucun
-- nouvel appel API), jamais agrégées en stat pariable jusqu'ici.
--
-- had_buzzer_beater/last_basket_player_id : PAR MATCH, sur stats_matchs --
-- had_buzzer_beater se glisse TEL QUEL dans le mécanisme MATCH_TOTAL déjà
-- en place (classifieur direct, même patron que had_backcourt_turnover).
-- last_basket_player_id (personId du dernier "Made Shot" du match, plus
-- grand actionNumber) sert UNIQUEMENT à la résolution (LAST_BASKET,
-- bet_subject dédié -- cf. migration suivante) -- pas de seuil/proba
-- associé côté colonne, juste le fait brut.
alter table stats_matchs add column had_buzzer_beater boolean;
alter table stats_matchs add column last_basket_player_id integer;

-- Même patron que bulk_update_match_timeouts (migration 20260825150000) --
-- un upsert à payload partiel échoue sur cette table (contraintes NOT NULL
-- de l'INSERT validées avant le conflit).
create or replace function bulk_update_match_buzzer_beater(rows jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update stats_matchs t
  set had_buzzer_beater = r.had_buzzer_beater, last_basket_player_id = r.last_basket_player_id
  from jsonb_to_recordset(rows) as r(game_id text, had_buzzer_beater boolean, last_basket_player_id integer)
  where t.game_id = r.game_id;
end;
$$;

-- contre SUR un joueur précis (BLOCK_ON_PLAYER) : table d'ÉVÉNEMENTS (1
-- ligne par contre, PAS "1 ligne courante par clé" comme le reste des
-- tables stats_* de ce projet) -- un même bloqueur peut contrer un même
-- adversaire plusieurs fois dans le même match, chaque occurrence compte.
-- Découvert en explorant les CSV locaux avant de coder (étape 6,
-- GAPS_OUVERTS.md) : une ligne "Block" porte le MÊME actionNumber que la
-- ligne "Missed Shot" juste avant elle (personId du Block = bloqueur,
-- personId du Missed Shot = tireur bloqué) -- aucun autre lien structuré
-- entre les 2 lignes dans le play-by-play brut.
create table stats_block_events (
  id bigint generated always as identity primary key,
  game_id text not null,
  blocker_player_id integer not null,
  victim_player_id integer not null
);
create index idx_block_events_lookup on stats_block_events(game_id, blocker_player_id, victim_player_id);

-- RLS activée SANS policy -- deny-all pour anon/authenticated, même
-- convention que le reste des tables stats_* (migration 20260821130000) :
-- le service (backfill/refresh_daily.py) ET la résolution
-- (resolveCalculableBets.ts) utilisent SUPABASE_SERVICE_ROLE_KEY, qui
-- contourne RLS -- jamais interrogée côté client authentifié.
alter table stats_block_events enable row level security;
