-- Rappel push « 8 h avant le match » : nouveau type de ligne de dédoublonnage,
-- distinct de MATCH_TONIGHT (rappel des 4 dernières heures).
alter table reminder_log drop constraint reminder_log_kind_check;
alter table reminder_log
  add constraint reminder_log_kind_check
  check (kind in ('MATCH_TONIGHT', 'MATCH_8H', 'BRACKET_DEADLINE'));
