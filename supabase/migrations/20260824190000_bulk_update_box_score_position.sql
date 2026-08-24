-- Backfill stats_box_scores.position (chantier "5 majeur/banc",
-- GAPS_OUVERTS.md, 24/08/2026) -- l'upsert standard (client.table(...)
-- .upsert(records, on_conflict=...)) échoue sur cette table : Postgres
-- valide les contraintes NOT NULL (game_date, etc) de la clause INSERT
-- AVANT même de tenter le conflit, donc un payload partiel
-- (game_id/player_id/position uniquement) est rejeté même quand la ligne
-- existe déjà et qu'on veut juste UPDATE une seule colonne. Fonction dédiée
-- pour un vrai UPDATE en masse depuis un tableau JSON, réutilisable pour
-- tout futur backfill du même genre (une colonne, beaucoup de lignes déjà
-- existantes).
create or replace function bulk_update_box_score_position(rows jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update stats_box_scores t
  set position = r.position
  from jsonb_to_recordset(rows) as r(game_id text, player_id integer, position text)
  where t.game_id = r.game_id and t.player_id = r.player_id;
end;
$$;
