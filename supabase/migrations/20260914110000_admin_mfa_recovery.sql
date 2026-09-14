-- 2FA admin obligatoire + gestion de session (p2-8, feuille de route Phase 2)
-- -- l'enrôlement/vérification TOTP et l'AAL de session sont entièrement
-- gérés par Supabase Auth (auth.mfa.*, natif) : rien à stocker côté public
-- pour ça. Ce qui manque et qu'on ajoute ici, c'est le plan de secours
-- choisi avec l'utilisateur (codes de récupération à usage unique, puisqu'il
-- n'y a qu'un seul compte admin -- perdre l'accès à l'appli d'authentification
-- sans filet bloquerait tout l'admin) et la lecture des sessions actives
-- (auth.sessions, pas exposé par défaut côté client).

-- Codes hashés uniquement (SHA-256, généré/hashé côté serveur dans
-- lib/auth/mfa.ts) -- jamais le texte en clair, qui n'est montré qu'une
-- fois à la génération, jamais relu depuis la base après coup.
create table admin_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index admin_recovery_codes_user_idx on admin_recovery_codes (user_id);

-- RLS activée sans policy : deny-all pour anon/authenticated -- seules les
-- fonctions SECURITY DEFINER ci-dessous y accèdent (même patron que
-- anon_rate_limit_events, migration 20260907140000).
alter table admin_recovery_codes enable row level security;

-- Session de contournement temporaire posée après consommation d'un code de
-- récupération (consume_admin_recovery_code) -- l'AAL réelle de la session
-- Supabase reste aal1 dans ce cas (impossible de la faire monter sans passer
-- par mfa.challengeAndVerify()), donc admin/layout.tsx vérifie CETTE table en
-- repli plutôt que l'AAL quand un cookie de session de secours est présent.
create table admin_recovery_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table admin_recovery_sessions enable row level security;

-- Régénère l'intégralité des codes de récupération de l'admin courant
-- (invalide tous les anciens, y compris non utilisés -- pas de codes qui
-- traînent indéfiniment). Hashage fait avant l'appel, côté serveur.
create or replace function regenerate_admin_recovery_codes(p_code_hashes text[])
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux admins';
  end if;

  delete from admin_recovery_codes where user_id = auth.uid();

  insert into admin_recovery_codes (user_id, code_hash)
  select auth.uid(), unnest(p_code_hashes);
end;
$$;

-- Consomme un code de récupération (usage unique) et ouvre une session de
-- secours de 30 minutes -- assez pour finir la tâche admin en cours puis
-- régénérer une vraie MFA depuis /mfa-setup, pas une session permanente.
create or replace function consume_admin_recovery_code(p_code_hash text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_matched_id uuid;
  v_session_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux admins';
  end if;

  update admin_recovery_codes
    set used_at = now()
    where user_id = auth.uid() and code_hash = p_code_hash and used_at is null
    returning id into v_matched_id;

  if v_matched_id is null then
    return null;
  end if;

  insert into admin_recovery_sessions (user_id, expires_at)
    values (auth.uid(), now() + interval '30 minutes')
    returning id into v_session_id;

  return v_session_id;
end;
$$;

create or replace function check_admin_recovery_session(p_session_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from admin_recovery_sessions
    where id = p_session_id and user_id = auth.uid() and expires_at > now()
  );
$$;

-- Sessions actives de l'admin courant (auth.sessions, schéma GoTrue -- pas
-- de RLS/API cliente dessus par défaut). Lecture seule, aucune colonne
-- sensible au-delà de ce que l'admin voit déjà lui-même dans son
-- navigateur (device/date approximatifs via user_agent).
create or replace function list_admin_sessions()
returns table (id uuid, created_at timestamptz, updated_at timestamptz, user_agent text)
language sql security definer stable
set search_path = public, auth
as $$
  select s.id, s.created_at, s.updated_at, s.user_agent
  from auth.sessions s
  where s.user_id = auth.uid() and public.is_admin()
  order by s.updated_at desc;
$$;

revoke all on function regenerate_admin_recovery_codes(text[]) from anon;
revoke all on function consume_admin_recovery_code(text) from anon;
revoke all on function check_admin_recovery_session(uuid) from anon;
revoke all on function list_admin_sessions() from anon;
