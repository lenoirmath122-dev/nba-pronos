-- Fonction atomique de purge des données possédées par un compte
-- (DATA-002 de l'audit du 03/09/2026, item A1 du plan d'action).
--
-- Remplace la séquence d'une vingtaine d'appels REST séparés que
-- lib/actions/account.ts::deleteAccountFormAction exécutait jusqu'ici pour
-- purger un compte -- chaque .update()/.delete() étant sa propre requête
-- HTTP (donc sa propre transaction Postgres implicite), une interruption
-- en cours de route (crash, timeout serverless) pouvait laisser un compte
-- partiellement supprimé, sans garantie transactionnelle. Une fonction
-- PL/pgSQL s'exécute dans UNE SEULE transaction Postgres implicite : soit
-- tout est purgé, soit rien ne l'est (rollback automatique sur erreur).
--
-- N'inclut PAS auth.admin.deleteUser() (API GoTrue, système séparé de
-- Postgres -- ne peut structurellement pas partager la même transaction) :
-- reste un 2e appel distinct côté TypeScript, après que cette fonction ait
-- réussi. Deux étapes restent donc nécessaires dans l'absolu, mais la 1re
-- (celle qui touche une quinzaine de tables) est désormais atomique.
--
-- Même ordre de suppression que scripts/delete-player-account.mjs
-- (feuilles vers racines, références admin nullifiées jamais supprimées).
--
-- SÉCURITÉ -- déroge volontairement à la convention du reste de ce schéma
-- (fonctions SECURITY DEFINER qui revalident auth.uid() en interne, ex.
-- save_bet/withdraw_bet) : cette fonction est appelée via service_role
-- (getServiceClient(), jamais le client de session), nécessaire pour
-- contourner l'absence de policies DELETE/UPDATE sur ces tables -- dans ce
-- contexte auth.uid() résout NULL, jamais l'id du joueur ciblé, donc un
-- contrôle "auth.uid() = p_user_id" serait toujours faux même pour un
-- appel légitime et bloquerait la fonction pour tout le monde. La
-- frontière de sécurité est donc portée par REVOKE ci-dessous (seul
-- service_role peut l'appeler) plutôt que par une revalidation interne --
-- jamais exposée à anon/authenticated, jamais appelable depuis le
-- navigateur ou par .rpc() côté client.
create or replace function delete_account_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Références admin : nullifiées (lignes appartenant à D'AUTRES joueurs,
  -- où la cible a seulement agi en tant qu'admin) -- jamais supprimées.
  update bets set validated_by_admin_id = null where validated_by_admin_id = p_user_id;
  update bets set resolved_by_admin_id = null where resolved_by_admin_id = p_user_id;
  update bets set corrected_by_admin_id = null where corrected_by_admin_id = p_user_id;
  update match_predictions set corrected_by_admin_id = null where corrected_by_admin_id = p_user_id;
  update bug_reports set resolved_by_admin_id = null where resolved_by_admin_id = p_user_id;
  update correction_requests set handled_by_admin_id = null where handled_by_admin_id = p_user_id;
  update entity_mappings set confirmed_by_admin_id = null where confirmed_by_admin_id = p_user_id;
  update chat_message_reports set message_author_id = null where message_author_id = p_user_id;
  update chat_message_reports set resolved_by_admin_id = null where resolved_by_admin_id = p_user_id;

  -- bracket_picks n'a pas de user_id direct -- purgé via les brackets de la cible.
  delete from bracket_picks where bracket_id in (select id from brackets where user_id = p_user_id);

  -- Casse la FK circulaire bets/match_predictions <-> correction_requests
  -- avant de purger cette dernière.
  update match_predictions set correction_request_id = null where user_id = p_user_id;
  update bets set correction_request_id = null where user_id = p_user_id;

  -- Tables possédées, feuilles vers racines.
  delete from correction_requests where requester_user_id = p_user_id;
  delete from bets where user_id = p_user_id;
  delete from match_predictions where user_id = p_user_id;
  delete from brackets where user_id = p_user_id;
  delete from chat_messages where user_id = p_user_id;
  delete from bug_reports where user_id = p_user_id;
  delete from chat_message_reports where reporter_user_id = p_user_id;
  delete from league_memberships where user_id = p_user_id;
  delete from leaderboard_snapshots where user_id = p_user_id;
  delete from competition_superlatives where user_id = p_user_id;
  delete from competition_archives where user_id = p_user_id;
  delete from audit_logs where actor_user_id = p_user_id;
end;
$$;

revoke all on function delete_account_data(uuid) from public;
revoke all on function delete_account_data(uuid) from anon;
revoke all on function delete_account_data(uuid) from authenticated;
