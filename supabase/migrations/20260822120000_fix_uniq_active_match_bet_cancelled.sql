-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION — FIX uniq_active_match_bet (CANCELLED)
-- ============================================================================
-- Motif : bug reel signale par l'utilisateur (22/08/2026) -- apres avoir
-- annule un pari MATCH (delete_bet -> CANCELLED, migration #29 du
-- 18/08/2026), impossible d'en soumettre un nouveau sur le meme match :
-- "duplicate key value violates unique constraint uniq_active_match_bet".
--
-- Cause : uniq_active_match_bet (20260718090000_initial_schema.sql) exclut
-- seulement REJECTED (`status <> 'REJECTED'`), jamais mis a jour quand
-- CANCELLED a ete introduit comme 2e statut "relache" (migration #29,
-- posterieure). Sa jumelle uniq_active_series_bet, elle, exclut deja les 2
-- (`status not in ('REJECTED', 'CANCELLED')`) -- meme regle que
-- RELEASED_BET_STATUSES cote TypeScript (lib/labels/bets.ts). Cette
-- migration aligne uniq_active_match_bet sur la meme regle.
--
-- Un index unique partiel ne peut pas etre ALTERed directement (son
-- predicat WHERE est immuable) -- DROP puis CREATE, comme pour toute
-- correction de ce genre dans ce projet.
-- ============================================================================

drop index if exists uniq_active_match_bet;

create unique index uniq_active_match_bet
  on bets (user_id, match_id)
  where scope = 'MATCH' and status not in ('REJECTED', 'CANCELLED');

-- ============================================================================
-- FIN.
-- Verif post-push : annuler un pari MATCH (delete_bet) puis en soumettre un
-- nouveau sur le MEME match doit reussir (plus de conflit d'index) --
-- reproduit le cas reel signale par l'utilisateur (pari Risacher annule,
-- resoumission bloquee).
-- ============================================================================
