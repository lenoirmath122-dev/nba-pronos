-- Phase 5 du chantier Data NBA (SPEC_TECHNIQUE_PROBA_PARIS_PERSOS_V0_1.md) :
-- colonnes accueillant le resultat de la structuration IA d'un pari perso
-- (texte libre -> joueur/stat/seuil) + la proba calculee par le
-- micro-service Cloud Run, figees a la soumission (meme logique P10 que le
-- reste de l'appli -- jamais recalculees apres coup, meme si le pari est
-- reentraine ou modifie plus tard).
--
-- Toutes NULLABLES : un pari non calculable (~1/3 des cas, categories
-- Fun/Scenario/Combo...) ou une extraction IA en echec laisse ces colonnes
-- a NULL -- comportement actuel (difficulte proposee/validee a la main)
-- entierement inchange, c'est le mecanisme de repli deja decide (spec §4).

alter table bets
  add column structured_player_name text,
  add column structured_stat text,
  add column structured_threshold numeric,
  add column structured_comparison text check (structured_comparison in ('OVER', 'UNDER')),
  add column is_calculable boolean,
  add column calculated_proba numeric check (calculated_proba is null or (calculated_proba between 0 and 1)),
  add column suggested_difficulty smallint check (suggested_difficulty is null or suggested_difficulty between 1 and 5);

-- Ecriture via RPC SECURITY DEFINER, meme patron que save_bet/withdraw_bet/
-- delete_bet (lib/actions/bets.ts) : session utilisateur (jamais
-- service_role), pas un UPDATE direct depuis le client -- verifie que
-- l'appelant est bien le proprietaire du pari et que celui-ci est encore au
-- statut attendu.
create or replace function update_bet_structuration(
  p_bet_id uuid,
  p_structured_player_name text,
  p_stat text,
  p_threshold numeric,
  p_comparison text,
  p_is_calculable boolean,
  p_calculated_proba numeric,
  p_suggested_difficulty smallint
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_status bet_status;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  select user_id, status into v_user_id, v_status from bets where id = p_bet_id;
  if v_user_id is null then
    raise exception 'Pari introuvable';
  end if;
  if v_user_id != auth.uid() then
    raise exception 'Ce pari ne t''appartient pas';
  end if;
  if v_status != 'SUBMITTED' then
    raise exception 'Ce pari n''est plus au statut attendu pour cette mise a jour';
  end if;

  update bets set
    structured_player_name = p_structured_player_name,
    structured_stat = p_stat,
    structured_threshold = p_threshold,
    structured_comparison = p_comparison,
    is_calculable = p_is_calculable,
    calculated_proba = p_calculated_proba,
    suggested_difficulty = p_suggested_difficulty
  where id = p_bet_id;
end;
$$;
