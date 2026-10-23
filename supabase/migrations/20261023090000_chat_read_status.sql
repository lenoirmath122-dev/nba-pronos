-- ============================================================================
-- NBA PRONOS — CHAT : ÉTAT « LU » PAR COMPTE (plus par navigateur)
-- ============================================================================
-- Fichier   : supabase/migrations/20261023090000_chat_read_status.sql
-- Motif     : le repère « lu » vivait dans localStorage ("chat-seen-at") : sur un
--             autre navigateur / appareil, tout l'historique récent
--             réapparaissait en non-lu. La base devient la source de vérité.
--
-- Décisions :
--   - Un canal = 'general' ou l'id de la ligue en texte (même clé que le
--     paramètre `?canal=` de /chat et que ChatChannelKey côté client). Une clé
--     texte plutôt que (scope_type, league_id) : league_id serait nullable
--     pour le Général, donc pas de PK composite ni d'upsert possible dessus.
--     Pas de FK vers leagues : une ligne orpheline après suppression de ligue
--     est inoffensive (jamais lue).
--   - Non lu = message d'un AUTRE joueur plus récent que last_read_at (le
--     calcul reste dans lib/nav/chatSeen.ts, sur les données serveur).
--   - last_read_at ne recule jamais (greatest), pour qu'un onglet en retard ne
--     rallume pas une pastille éteinte ailleurs.
--   - Realtime : lire un canal sur un appareil éteint la pastille sur les autres.
--   - Les comptes existants sont initialisés à now() sur Général + leurs
--     ligues : rien ne réapparaît en non-lu au déploiement.
-- ============================================================================

create table chat_read_status (
  user_id uuid not null references users(id) on delete cascade,
  channel text not null,
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, channel)
);

alter table chat_read_status enable row level security;

-- Self-service : chacun ne lit/écrit que ses lignes, et seulement pour un canal
-- auquel il a accès (Général, ou une de ses ligues).
create policy chat_read_status_all on chat_read_status for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      channel = 'general'
      or channel in (select l::text from public.my_league_ids() as l)
    )
  );

-- Marque un canal comme lu maintenant (SECURITY INVOKER : la RLS s'applique).
create function mark_chat_channel_read(p_channel text) returns void
language sql
as $$
  insert into chat_read_status (user_id, channel, last_read_at, updated_at)
  values (auth.uid(), p_channel, now(), now())
  on conflict (user_id, channel) do update
    set last_read_at = greatest(chat_read_status.last_read_at, excluded.last_read_at),
        updated_at = now();
$$;

alter publication supabase_realtime add table chat_read_status;

-- ── Initialisation des comptes existants ────────────────────────────────────

insert into chat_read_status (user_id, channel)
select id, 'general' from users
on conflict do nothing;

insert into chat_read_status (user_id, channel)
select user_id, league_id::text from league_memberships
on conflict do nothing;
