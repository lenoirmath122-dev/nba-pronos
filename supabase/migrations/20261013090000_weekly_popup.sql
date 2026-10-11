-- NBA PRONOS — Classement hebdo, lot 5, PR 1 : données de la popup hebdomadaire.
--
-- Fichier : 20261013090000_weekly_popup.sql
-- Motif   : popup hebdomadaire humoristique rédigée par LLM, relue par un admin
--           (plan : Cadrage/Fonctionnel/nba_pronos_plan_technique_popup_hebdo.md §1).
--
-- - bets.rejected_at : date du refus, posée par trigger (jamais remise à NULL),
--   remplie pour l'existant depuis audit_logs.
-- - users.popup_mentions_opt_out : « ne pas me citer » (rétroactif à l'affichage).
-- - competitions.weekly_popup : interrupteur par compétition (défaut false).
-- - weekly_popups : brouillons et textes publiés, LECTURE ADMIN SEULE (elle
--   contient des textes bloqués par le classifieur et les refusés des autres).
-- - weekly_popup_views : état « vu » par joueur (en base, pas par appareil).
-- - current_weekly_popup() / my_weekly_popup_mentions() : seules lectures
--   joueur, security definer, ne renvoient que le contenu publié.
-- - ai_usage_logs : colonnes de journal nullables (le code existant n'est pas touché).
-- - delete_account_data() : purge des mentions et des candidats du compte supprimé.
--
-- Contenu stocké en jetons {{u:<uuid>}} résolus à l'affichage (plan §1.9) :
-- un compte supprimé devient « un ancien joueur », un refus d'être cité
-- « un joueur discret ».

-- ── 1. bets.rejected_at ──────────────────────────────────────────────────────
alter table bets add column if not exists rejected_at timestamptz;

create index if not exists idx_bets_comp_rejected_at
  on bets (competition_id, rejected_at) where status = 'REJECTED';
create index if not exists idx_bets_comp_resolved_at
  on bets (competition_id, resolved_at) where status in ('WON', 'LOST');

create or replace function bets_set_rejected_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'REJECTED' then
    if tg_op = 'INSERT' then
      new.rejected_at := now();
    elsif old.status is distinct from 'REJECTED' then
      -- toute (re)transition vers REJECTED repose la date
      new.rejected_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bets_set_rejected_at on bets;
create trigger trg_bets_set_rejected_at
  before insert or update of status on bets
  for each row execute function bets_set_rejected_at();

-- Remplissage de l'existant : le dernier REJECT_BET de l'audit. Sans audit
-- (refus passé par une correction admin, écriture best-effort échouée, audit
-- purgé avec un compte admin supprimé) : NULL, et la présélection exclut
-- `rejected_at is null`. Aucun repli sur updated_at ni submitted_at (faux).
update bets b
   set rejected_at = a.rejected_ts
  from (
    select target_id, max(created_at) as rejected_ts
      from audit_logs
     where action = 'REJECT_BET' and target_type = 'bet'
     group by target_id
  ) a
 where b.id = a.target_id
   and b.status = 'REJECTED'
   and b.rejected_at is null;

-- ── 2. Interrupteurs ─────────────────────────────────────────────────────────
alter table users
  add column if not exists popup_mentions_opt_out boolean not null default false;
alter table competitions
  add column if not exists weekly_popup boolean not null default false;

-- ── 3. weekly_popups (admin seulement) ───────────────────────────────────────
create table if not exists weekly_popups (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null,
  week_end_date date not null,
  kind text not null default 'LLM' check (kind in ('LLM', 'FALLBACK')),
  status text not null check (
    status in ('GENERATING', 'READY', 'DOUBTFUL', 'PUBLISHED', 'SKIPPED', 'RETRACTED')
  ),
  -- invalid_output, max_tokens, api_error, timeout, cap_reached, refusal,
  -- structure, budget, stale
  doubt_code text,
  doubt_detail text,
  generation_id uuid,                 -- jeton de la génération en cours (anti-écrasement)
  generation_started_at timestamptz,
  generation_count int not null default 0,
  prompt_version text,                -- 'redacteur-v5/classifieur-v1'
  candidates jsonb not null default '[]'::jsonb,
  generated_content jsonb,            -- dernière sortie LLM validée, jetons
  raw_output text,                    -- sortie brute si invalid_output, effacée à la publication
  content jsonb,                      -- version éditable puis publiée, jetons
  warnings jsonb not null default '[]'::jsonb,
  attempts jsonb not null default '[]'::jsonb,
  featured_user_ids uuid[] not null default '{}',
  admin_notified_at timestamptz,
  published_at timestamptz,
  published_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id, week_end_date),
  -- Aucune popup pour une semaine non figée. Sans ON DELETE : une ligne ici
  -- bloque la suppression de weekly_rankings (donc de la compétition) ; retirer
  -- d'abord la popup de la semaine (fixtures d'intégration, correction manuelle).
  foreign key (competition_id, week_end_date)
    references weekly_rankings (competition_id, week_end_date),
  check (status not in ('PUBLISHED', 'RETRACTED') or published_at is not null)
);

create index if not exists idx_weekly_popups_comp_status
  on weekly_popups (competition_id, status, week_end_date desc);

create or replace function weekly_popups_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_weekly_popups_touch on weekly_popups;
create trigger trg_weekly_popups_touch
  before update on weekly_popups
  for each row execute function weekly_popups_touch_updated_at();

alter table weekly_popups enable row level security;
drop policy if exists weekly_popups_select_admin on weekly_popups;
create policy weekly_popups_select_admin on weekly_popups
  for select using (public.is_admin());
-- Aucune policy d'écriture : service_role seul. NE JAMAIS ajouter de policy de
-- lecture joueur ici.

-- ── 4. weekly_popup_views (état « vu » par joueur) ───────────────────────────
create table if not exists weekly_popup_views (
  popup_id uuid not null references weekly_popups(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (popup_id, user_id)
);

create index if not exists idx_weekly_popup_views_user on weekly_popup_views (user_id);

alter table weekly_popup_views enable row level security;
drop policy if exists wpv_select_own on weekly_popup_views;
create policy wpv_select_own on weekly_popup_views
  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists wpv_insert_own on weekly_popup_views;
create policy wpv_insert_own on weekly_popup_views
  for insert with check (user_id = auth.uid());

-- ── 5. RPC de lecture joueur ─────────────────────────────────────────────────
-- Dernière popup PUBLISHED de la compétition ACTIVE, publiée depuis moins de
-- 7 jours, non vue par l'appelant. Ne renvoie que {id, week_end_date, kind,
-- content} : jamais candidates, raw_output, verdicts.
create or replace function current_weekly_popup()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'id', p.id,
           'week_end_date', p.week_end_date,
           'kind', p.kind,
           'content', p.content
         )
    from weekly_popups p
    join competitions c on c.id = p.competition_id
   where auth.uid() is not null
     and c.status = 'ACTIVE'
     and p.status = 'PUBLISHED'
     and p.content is not null
     and p.published_at > now() - interval '7 days'
     and not exists (
       select 1 from weekly_popup_views v
        where v.popup_id = p.id and v.user_id = auth.uid()
     )
   order by p.published_at desc
   limit 1;
$$;

revoke all on function current_weekly_popup() from public;
revoke all on function current_weekly_popup() from anon;
grant execute on function current_weekly_popup() to authenticated;

-- Export RGPD : popups publiées ou retirées qui citent l'appelant. Le contenu
-- contient des jetons {{u:uuid}} : la route d'export les détokenise.
create or replace function my_weekly_popup_mentions()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'week_end_date', p.week_end_date,
               'published_at', p.published_at,
               'content', p.content
             )
             order by p.published_at
           ),
           '[]'::jsonb
         )
    from weekly_popups p
   where auth.uid() is not null
     and p.status in ('PUBLISHED', 'RETRACTED')
     and auth.uid() = any (p.featured_user_ids);
$$;

revoke all on function my_weekly_popup_mentions() from public;
revoke all on function my_weekly_popup_mentions() from anon;
grant execute on function my_weekly_popup_mentions() to authenticated;

-- ── 6. ai_usage_logs : colonnes de journal ───────────────────────────────────
alter table ai_usage_logs
  add column if not exists status text,
  add column if not exists stop_reason text,
  add column if not exists request_id text,
  add column if not exists latency_ms int,
  add column if not exists thinking_tokens int,
  add column if not exists attempt int;

create index if not exists idx_ai_usage_logs_callsite_created
  on ai_usage_logs (call_site, created_at desc);

-- ── 7. delete_account_data : version de 20261012090000 + purge des popups ────
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

  -- Popups hebdo : la cible n'est plus nommée (jeton -> {{u:supprime}}), ses
  -- candidats (texte de ses paris) et sa sortie brute sont purgés. weekly_popup_views
  -- part en cascade avec le compte ; published_by passe à NULL (on delete set null).
  -- replace(NULL) donne NULL sans erreur ; un uuid n'a aucun caractère spécial.
  update weekly_popups set
    candidates = coalesce(
      (select jsonb_agg(c order by o)
         from jsonb_array_elements(candidates) with ordinality e(c, o)
        where c->>'user_id' is distinct from p_user_id::text),
      '[]'::jsonb
    ),
    featured_user_ids = array_remove(featured_user_ids, p_user_id),
    content = replace(content::text, '{{u:' || p_user_id::text || '}}', '{{u:supprime}}')::jsonb,
    generated_content = replace(generated_content::text, '{{u:' || p_user_id::text || '}}', '{{u:supprime}}')::jsonb,
    raw_output = null
  where candidates @> jsonb_build_array(jsonb_build_object('user_id', p_user_id::text))
     or p_user_id = any (featured_user_ids)
     or content::text like '%{{u:' || p_user_id::text || '}}%'
     or generated_content::text like '%{{u:' || p_user_id::text || '}}%';

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
  -- membre -- une ligue encore multi-membres reste intacte (comportement
  -- pré-existant).
  delete from leagues
    where created_by_user_id = p_user_id
      and not exists (
        select 1 from league_memberships
        where league_memberships.league_id = leagues.id
          and league_memberships.user_id <> p_user_id
      );

  -- Palmarès hebdo : weekly_champions.user_id n'a pas de ON DELETE, purge
  -- explicite (sinon la FK bloquerait auth.admin.deleteUser()). weekly_rankings
  -- (en-tête de semaine, sans user_id) reste.
  delete from weekly_champions where user_id = p_user_id;
  delete from leaderboard_snapshots where user_id = p_user_id;
  delete from competition_superlatives where user_id = p_user_id;
  delete from competition_archives where user_id = p_user_id;
  delete from audit_logs where actor_user_id = p_user_id;
end;
$$;

-- CREATE OR REPLACE conserve les droits ; répétés par prudence (sans effet).
revoke all on function delete_account_data(uuid) from public;
revoke all on function delete_account_data(uuid) from anon;
revoke all on function delete_account_data(uuid) from authenticated;
