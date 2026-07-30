-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #16 — LIGUES (BACKLOG_V1.md « Système de ligue »)
-- ============================================================================
-- Fichier   : supabase/migrations/20260730090000_leagues.sql
-- Motif     : BACKLOG_V1.md « Système de ligue » — groupement d'amis façon MPP,
--             VUE FILTRÉE sur le classement existant (mêmes pronos, même
--             scoring, même classement global). Ne touche NI au scoring, NI
--             aux statuts, NI aux workflows déjà validés — pur ajout.
--             Distinct du code compétition (qui a le droit de JOUER) —
--             explicitement écarté d'y toucher, voir
--             nba_pronos_PREP_SPEC_TECHNIQUE_V1.md §C4.
--
-- Décisions actées AVEC l'utilisateur (30/07/2026, aucune spec d'écran
-- n'existait avant cette session — cadrées en séance, même patron que le
-- Bracket personnel le 27/07/2026) :
--   - Ligue PERMANENTE, indépendante des compétitions (contrairement aux
--     brackets/pronos qui sont scopés à une compétition) — le filtre
--     s'applique au classement de la compétition ACTIVE courante, quelle
--     qu'elle soit.
--   - Un joueur peut appartenir à PLUSIEURS ligues simultanément.
--   - N'IMPORTE QUEL joueur ACTIVE peut créer une ligue (pas réservé à
--     l'admin, contrairement aux compétitions). Rejoint via un CODE généré
--     aléatoirement à la création (pas un mot de passe choisi) — même
--     esprit que le code compétition (C4), mais un code par LIGUE, pas par
--     compétition.
--   - Rang affiché dans la vue filtrée : RECALCULÉ dans le groupe (1er/2e/3e
--     parmi les seuls membres de la ligue), pas le rang général conservé.
--
-- Modèle : 3 tables neuves, aucune existante modifiée.
--   - leagues            : nom (public), créateur, date.
--   - league_secrets      : code de ligue, SORTI de leagues dès la conception
--     (même correctif que competition_secrets, T3 §3/migration #3 RLS) —
--     jamais exposé à un non-membre.
--   - league_memberships  : appartenance (many-to-many joueurs <-> ligues).
--
-- Écriture : DEUX fonctions SECURITY DEFINER (create_league / join_league),
-- même patron que request_prediction_correction (migration #7) — un joueur
-- ACTIVE quelconque doit pouvoir créer une ligue et en écrire la ligne
-- league_secrets alors qu'aucune policy RLS directe ne le permettrait
-- (le code ne doit jamais transiter par un INSERT ouvert). Quitter une ligue
-- reste un DELETE direct (RLS suffit, pas de logique particulière).
-- ============================================================================

-- ── 1. Tables ────────────────────────────────────────────────────────────────

create table leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by_user_id uuid not null references users(id),
  created_at timestamptz not null default now()
);

-- Secret sorti de leagues dès la conception (pas de correctif à faire plus
-- tard, contrairement à competition_secrets qui a dû être extrait après coup).
create table league_secrets (
  league_id uuid primary key references leagues(id) on delete cascade,
  code text not null unique
);

create table league_memberships (
  league_id uuid not null references leagues(id) on delete cascade,
  user_id uuid not null references users(id),
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create index idx_league_memberships_user on league_memberships (user_id);

-- ── 2. RLS ───────────────────────────────────────────────────────────────────

alter table leagues            enable row level security;
alter table league_secrets     enable row level security;
alter table league_memberships enable row level security;

-- leagues / league_secrets : visibles UNIQUEMENT des membres (confidentialité
-- de groupe, ce ne sont pas des compétitions publiques). Un membre peut voir
-- le code de sa propre ligue (pour inviter d'autres amis) — il le connaît déjà
-- puisque c'est ainsi qu'il a rejoint, aucune fuite nouvelle.
create policy leagues_select on leagues for select using (
  exists (
    select 1 from league_memberships lm
    where lm.league_id = leagues.id and lm.user_id = auth.uid()
  )
);

create policy league_secrets_select on league_secrets for select using (
  exists (
    select 1 from league_memberships lm
    where lm.league_id = league_secrets.league_id and lm.user_id = auth.uid()
  )
);

-- league_memberships : ma propre ligne, OU une ligne d'une ligue dont je suis
-- déjà membre (nécessaire pour construire la liste des user_id à filtrer sur
-- le classement — cf. lib/queries/leaderboard.ts).
create policy league_memberships_select on league_memberships for select using (
  user_id = auth.uid()
  or league_id in (select league_id from league_memberships where user_id = auth.uid())
);

-- Quitter une ligue : DELETE direct, aucune logique particulière (contrairement
-- à la création/l'adhésion, qui passent par les fonctions ci-dessous pour
-- gérer le code sans jamais l'exposer via un INSERT ouvert).
create policy league_memberships_delete on league_memberships for delete using (
  user_id = auth.uid()
);

-- Pas de policy insert/update sur leagues / league_secrets / league_memberships
-- pour les joueurs : toute écriture passe par create_league / join_league.

-- ── 3. Fonctions d'écriture (SECURITY DEFINER) ──────────────────────────────

create or replace function public.create_league(p_name text)
returns table (id uuid, name text, code text)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := trim(p_name);
  v_league_id uuid;
  v_code text;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  if not public.is_active() then
    raise exception 'Compte desactive : creation impossible';
  end if;

  if length(v_name) = 0 then
    raise exception 'Nom de ligue obligatoire';
  end if;

  insert into leagues (name, created_by_user_id)
  values (v_name, v_user_id)
  returning leagues.id into v_league_id;

  -- Code unique, format identique au code compétition (C4/T2) : 8 caractères
  -- hexadécimaux majuscules. Collision quasi impossible (espace 16^8) — boucle
  -- de sûreté plutôt qu'un contrôle jamais atteint en pratique.
  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    exit when not exists (select 1 from league_secrets where league_secrets.code = v_code);
  end loop;

  insert into league_secrets (league_id, code) values (v_league_id, v_code);

  -- Le créateur rejoint automatiquement sa propre ligue.
  insert into league_memberships (league_id, user_id) values (v_league_id, v_user_id);

  return query select v_league_id, v_name, v_code;
end;
$$;

create or replace function public.join_league(p_code text)
returns table (id uuid, name text)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_league_id uuid;
  v_name text;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  if not public.is_active() then
    raise exception 'Compte desactive : adhesion impossible';
  end if;

  select ls.league_id, l.name into v_league_id, v_name
  from league_secrets ls
  join leagues l on l.id = ls.league_id
  where lower(trim(ls.code)) = lower(trim(p_code));

  if v_league_id is null then
    raise exception 'Code de ligue invalide';
  end if;

  -- Idempotent : rejoindre une ligue dont on est déjà membre ne duplique rien
  -- (contrainte de clé primaire league_memberships), ne lève pas d'erreur non
  -- plus (même esprit que request_prediction_correction : réutiliser, jamais
  -- doubler).
  insert into league_memberships (league_id, user_id)
  values (v_league_id, v_user_id)
  on conflict (league_id, user_id) do nothing;

  return query select v_league_id, v_name;
end;
$$;

-- ============================================================================
-- FIN — migration #16.
-- Vérif post-push : create_league en session joueur réelle (ligne leagues +
-- league_secrets + league_memberships créées, code retourné) ; join_league
-- avec ce code depuis un AUTRE compte (adhésion) ; join_league en double
-- (idempotent, pas de doublon) ; join_league avec un code invalide (erreur
-- propre) ; SELECT direct sur league_secrets depuis un compte NON membre
-- (0 ligne, RLS confirmée) ; DELETE league_memberships (quitter) confirmé.
-- ============================================================================
