-- ============================================================================
-- Paris : plus aucune écriture directe (REST) par un joueur.
--
-- Faille (19/11/2026) : les policies bets_insert et bets_update_self laissaient
-- un joueur écrire dans `bets` via l'API REST, avec la clé publique et son
-- propre jeton, sans passer par les fonctions SQL de l'appli :
--   - INSERT d'un pari déjà VALIDATED avec la validated_difficulty de son choix
--     (le trigger enforce_bet_transitions ne porte que sur l'UPDATE) ;
--   - UPDATE DRAFT -> SUBMITTED -> VALIDATED, difficulté au choix, sans IA ;
--   - UPDATE du match_id d'un brouillon vers un match déjà joué (la deadline
--     n'était vérifiée que sur la ligne AVANT modification).
--
-- Toutes les écritures joueur passent déjà par des fonctions SECURITY DEFINER
-- (save_bet, withdraw_bet, delete_bet, update_bet_structuration, reopen_bet).
-- Elles appartiennent au propriétaire de la table, et aucune table n'est en
-- FORCE ROW LEVEL SECURITY : la RLS ne s'y applique pas, elles ne dépendent
-- donc pas de ces policies. Admin (bets_update_admin) et service_role
-- (résolution, scripts) sont inchangés. La lecture (bets_select) aussi.
-- ============================================================================

drop policy if exists bets_insert on public.bets;
drop policy if exists bets_update_self on public.bets;
