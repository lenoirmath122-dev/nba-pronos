-- Changement de pseudo avec validation admin (12/10/2026).
--
-- Jusqu'ici users.pseudo était modifiable par le joueur lui-même (policy
-- users_update_self sans garde de colonne) mais aucun écran ne le proposait.
-- Désormais : le joueur DEMANDE un nouveau pseudo, un admin approuve ou
-- refuse. Tout passe par trois fonctions SECURITY DEFINER (atomiques) ; la
-- table n'a aucune policy d'écriture.
--
-- Règles : 3 à 20 caractères, unique sans tenir compte de la casse (y compris
-- face aux demandes en attente), une seule demande en attente par joueur, un
-- délai de 30 jours après une demande approuvée.

create table pseudo_change_requests (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  old_pseudo       text not null,                 -- figé : users.pseudo est mutable
  requested_pseudo text not null,
  status           text not null default 'PENDING'
                   check (status in ('PENDING','APPROVED','REJECTED')),
  reject_reason    text,
  decided_by       uuid references users(id) on delete set null,
  decided_at       timestamptz,
  created_at       timestamptz not null default now()
);

create unique index uniq_pending_pseudo_request_per_user
  on pseudo_change_requests (user_id) where status = 'PENDING';
create unique index uniq_pending_requested_pseudo
  on pseudo_change_requests (lower(requested_pseudo)) where status = 'PENDING';
create index idx_pseudo_requests_user on pseudo_change_requests (user_id, created_at desc);

alter table pseudo_change_requests enable row level security;

create policy pcr_select_own_or_admin on pseudo_change_requests
  for select using (user_id = auth.uid() or public.is_admin());

-- ── Garde-fou : plus de changement de pseudo direct par le joueur ────────────
-- auth.uid() = old.id : le joueur lui-même (admin compris). Un admin qui
-- approuve la demande d'un AUTRE joueur passe (auth.uid() <> old.id), de même
-- que service_role (auth.uid() null).
create or replace function public.enforce_users_invariants()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Contexte système/privilégié (service_role, seed) : aucune garde
  -- utilisateur (cf. migration 20260718120000).
  if auth.uid() is null then
    return new;
  end if;

  if new.pseudo is distinct from old.pseudo and auth.uid() = old.id then
    raise exception 'Le pseudo ne se change que par une demande validee par un admin';
  end if;

  -- Seul un admin peut modifier role ou status.
  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and not public.is_admin() then
    raise exception 'Modification de role/status reservee aux admins';
  end if;
  -- Un admin ne peut pas se retrograder lui-meme.
  if auth.uid() = old.id and old.role = 'ADMIN' and new.role <> 'ADMIN' then
    raise exception 'Un admin ne peut pas se retrograder lui-meme';
  end if;
  -- Le dernier admin actif ne peut etre ni retrograde ni desactive.
  if old.role = 'ADMIN' and old.status = 'ACTIVE'
     and (new.role <> 'ADMIN' or new.status <> 'ACTIVE') then
    if (select count(*) from users
        where role = 'ADMIN' and status = 'ACTIVE' and id <> old.id) = 0 then
      raise exception 'Impossible de retirer le dernier admin actif';
    end if;
  end if;
  return new;
end;
$$;

-- ── Demande (joueur) ─────────────────────────────────────────────────────────
-- Retourne un code : OK | INVALID_LENGTH | SAME | TAKEN | PENDING_EXISTS |
-- COOLDOWN | UNAUTHENTICATED.
create function public.request_pseudo_change(p_new text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_new text := btrim(coalesce(p_new, ''));
  v_old text;
begin
  if v_uid is null then return 'UNAUTHENTICATED'; end if;
  if char_length(v_new) < 3 or char_length(v_new) > 20 then return 'INVALID_LENGTH'; end if;

  select pseudo into v_old from users where id = v_uid;
  if v_old is null then return 'UNAUTHENTICATED'; end if;
  if v_old = v_new then return 'SAME'; end if;

  if exists (select 1 from pseudo_change_requests where user_id = v_uid and status = 'PENDING') then
    return 'PENDING_EXISTS';
  end if;
  if exists (
    select 1 from pseudo_change_requests
    where user_id = v_uid and status = 'APPROVED' and decided_at > now() - interval '30 days'
  ) then
    return 'COOLDOWN';
  end if;
  if exists (select 1 from users where lower(pseudo) = lower(v_new) and id <> v_uid)
     or exists (select 1 from pseudo_change_requests
                where status = 'PENDING' and lower(requested_pseudo) = lower(v_new)) then
    return 'TAKEN';
  end if;

  insert into pseudo_change_requests (user_id, old_pseudo, requested_pseudo)
  values (v_uid, v_old, v_new);
  return 'OK';
exception when unique_violation then
  return 'TAKEN';
end;
$$;

-- ── Décision (admin) ─────────────────────────────────────────────────────────
-- Retourne : OK | FORBIDDEN | NOT_FOUND | ALREADY_DONE | SELF | TAKEN.
create function public.approve_pseudo_change(p_request_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  r pseudo_change_requests%rowtype;
begin
  if not public.is_admin() then return 'FORBIDDEN'; end if;
  select * into r from pseudo_change_requests where id = p_request_id for update;
  if not found then return 'NOT_FOUND'; end if;
  if r.status <> 'PENDING' then return 'ALREADY_DONE'; end if;
  if r.user_id = auth.uid() then return 'SELF'; end if;
  if exists (select 1 from users where lower(pseudo) = lower(r.requested_pseudo) and id <> r.user_id) then
    return 'TAKEN';
  end if;

  update users set pseudo = r.requested_pseudo where id = r.user_id;
  update pseudo_change_requests
     set status = 'APPROVED', decided_by = auth.uid(), decided_at = now()
   where id = r.id;
  return 'OK';
end;
$$;

create function public.reject_pseudo_change(p_request_id uuid, p_reason text)
returns text language plpgsql security definer set search_path = public as $$
declare
  r pseudo_change_requests%rowtype;
begin
  if not public.is_admin() then return 'FORBIDDEN'; end if;
  select * into r from pseudo_change_requests where id = p_request_id for update;
  if not found then return 'NOT_FOUND'; end if;
  if r.status <> 'PENDING' then return 'ALREADY_DONE'; end if;
  if r.user_id = auth.uid() then return 'SELF'; end if;

  update pseudo_change_requests
     set status = 'REJECTED', decided_by = auth.uid(), decided_at = now(),
         reject_reason = nullif(btrim(coalesce(p_reason, '')), '')
   where id = r.id;
  return 'OK';
end;
$$;

revoke all on function request_pseudo_change(text) from public;
revoke all on function request_pseudo_change(text) from anon;
grant execute on function request_pseudo_change(text) to authenticated;
revoke all on function approve_pseudo_change(uuid) from public;
revoke all on function approve_pseudo_change(uuid) from anon;
grant execute on function approve_pseudo_change(uuid) to authenticated;
revoke all on function reject_pseudo_change(uuid, text) from public;
revoke all on function reject_pseudo_change(uuid, text) from anon;
grant execute on function reject_pseudo_change(uuid, text) to authenticated;
