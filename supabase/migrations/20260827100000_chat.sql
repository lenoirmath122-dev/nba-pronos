-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #? — CHAT (Général + par ligue)
-- ============================================================================
-- Fichier   : supabase/migrations/20260827100000_chat.sql
-- Motif     : BACKLOG_V1.md « Communication entre joueurs » — cadré en séance
--             le 27/08/2026, voir Cadrage/Suivi/SPEC_CHAT_V0_1.md pour le
--             détail des décisions et du plan.
--
-- Décisions actées AVEC l'utilisateur (27/08/2026) :
--   - Portée : un canal Général (permanent, tout joueur ACTIVE) + un canal
--     par ligue existante (leagues/league_memberships, migration #16) —
--     pas de nouvelle notion de "salon", le canal ligue est 1:1 avec une
--     ligue.
--   - Modération : ADMIN uniquement (public.is_admin(), migration #3) peut
--     supprimer n'importe quel message. Pas de self-edit/self-delete —
--     un message posté est immuable jusqu'à suppression admin.
--   - Temps réel : oui, via la publication supabase_realtime (même patron
--     que matches/series, migrations #8/#14).
--
-- RLS : league_id in (select public.my_league_ids()) plutôt qu'un EXISTS
-- direct sur league_memberships — league_memberships_select a déjà mordu
-- une fois sur la récursion RLS (migration #17), my_league_ids()
-- (SECURITY DEFINER) est le patron déjà validé pour toute autre table qui a
-- besoin "des ligues de l'utilisateur courant".
-- ============================================================================

-- ── 1. Table ─────────────────────────────────────────────────────────────────

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('GLOBAL', 'LEAGUE')),
  league_id uuid references leagues(id) on delete cascade,
  user_id uuid not null references users(id),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  constraint chat_messages_scope_consistency check (
    (scope_type = 'GLOBAL' and league_id is null)
    or (scope_type = 'LEAGUE' and league_id is not null)
  )
);

create index idx_chat_messages_global
  on chat_messages (created_at desc) where scope_type = 'GLOBAL';
create index idx_chat_messages_league
  on chat_messages (league_id, created_at desc) where scope_type = 'LEAGUE';

-- ── 2. RLS ───────────────────────────────────────────────────────────────────

alter table chat_messages enable row level security;

-- Lecture : Général ouvert à tout joueur authentifié ; canal ligue réservé
-- aux membres ; admin voit tout (même patron que brackets_select/bets_select).
create policy chat_messages_select on chat_messages for select using (
  scope_type = 'GLOBAL'
  or public.is_admin()
  or league_id in (select public.my_league_ids())
);

-- Écriture : l'auteur est toujours soi-même, compte ACTIVE, et membre de la
-- ligue ciblée si scope_type = 'LEAGUE' (impossible de poster dans une ligue
-- dont on n'est pas membre même en forgeant la requête).
create policy chat_messages_insert on chat_messages for insert with check (
  user_id = auth.uid()
  and public.is_active()
  and (
    scope_type = 'GLOBAL'
    or league_id in (select public.my_league_ids())
  )
);

-- Suppression : admin uniquement (décision actée : pas de self-delete).
create policy chat_messages_delete_admin on chat_messages for delete using (
  public.is_admin()
);

-- Pas de policy update : un message posté est immuable.

-- ── 3. Realtime ──────────────────────────────────────────────────────────────

alter publication supabase_realtime add table chat_messages;

-- ============================================================================
-- FIN.
-- Vérif post-push : insert Général depuis un compte réel (RLS respectée,
-- lecture possible pour un autre compte) ; insert canal ligue depuis un
-- membre (OK) puis depuis un non-membre (rejeté par chat_messages_insert) ;
-- lecture d'un canal ligue par un non-membre (0 ligne, chat_messages_select) ;
-- DELETE par un compte non-admin (rejeté) puis par un admin (OK) ; ET —
-- point neuf pour ce projet — écoute Realtime brute (hors UI, événements
-- INSERT uniquement, cf. SPEC_CHAT_V0_1 §5 : DELETE volontairement PAS
-- diffusé en direct) d'un canal ligue par un compte non-membre : aucun
-- événement ne doit remonter (1er vrai test d'une policy restrictive sur le
-- canal Realtime, cf. SPEC_CHAT_V0_1 §4).
-- ============================================================================
