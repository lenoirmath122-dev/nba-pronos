-- Corrige un vrai bug trouvé en investiguant p1-22 -> p1-28 (feuille de
-- route Phase 1) : delete_account_data() (migration 20260903140000) ne
-- purgeait jamais les lignes `leagues` créées par le compte supprimé.
--
-- Séquence qui échouait : un joueur crée une ligue SOLO (jamais rejointe par
-- personne d'autre) -> demande la suppression de son compte -> le garde-fou
-- app-side (lib/actions/account.ts::deleteAccountFormAction) ne bloque QUE
-- si la ligue a D'AUTRES membres (count > 0), donc une ligue solo passe la
-- garde -> delete_account_data() purge bets/predictions/brackets/chat/sa
-- propre league_memberships avec succès -> mais `leagues` elle-même reste,
-- `created_by_user_id` (references users(id), pas de ON DELETE) bloque
-- ensuite le CASCADE déclenché par auth.admin.deleteUser() (public.users
-- référence auth.users(id) on delete cascade, migration initiale) ->
-- violation de contrainte FK -> deleteUser() échoue -> le compte reste dans
-- un état incohérent : toutes ses données possédées déjà purgées, mais sa
-- ligne users/auth.users toujours là.
--
-- Corrigé en ajoutant la purge des ligues créées par la cible, mais
-- SEULEMENT celles dont elle était l'unique membre -- revérifié ICI (NOT
-- EXISTS un autre membre) plutôt que de faire confiance à la garde app-side
-- déjà en place, même principe défensif que le reste de cette fonction
-- (jamais supprimer silencieusement les données d'un AUTRE joueur). Place
-- après la purge de league_memberships (ordre feuilles -> racines déjà
-- établi par la fonction) ; league_secrets suit automatiquement via son
-- propre "on delete cascade" sur leagues(id) (migration #16).
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

  -- Ligues créées par la cible, purgées SEULEMENT si elle en était l'unique
  -- membre (voir commentaire de migration ci-dessus) -- une ligue encore
  -- multi-membres reste intacte, laissant created_by_user_id pointer vers un
  -- compte qui n'existera plus (déjà le cas aujourd'hui si le créateur
  -- quitte sa propre ligue sans la supprimer, comportement pré-existant).
  delete from leagues
    where created_by_user_id = p_user_id
      and not exists (
        select 1 from league_memberships
        where league_memberships.league_id = leagues.id
          and league_memberships.user_id <> p_user_id
      );

  delete from leaderboard_snapshots where user_id = p_user_id;
  delete from competition_superlatives where user_id = p_user_id;
  delete from competition_archives where user_id = p_user_id;
  delete from audit_logs where actor_user_id = p_user_id;
end;
$$;
