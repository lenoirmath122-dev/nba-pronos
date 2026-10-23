-- ============================================================================
-- NBA PRONOS — ÉTAT « VU / FERMÉ » PAR COMPTE (plus par navigateur)
-- ============================================================================
-- Fichier   : supabase/migrations/20261023100000_user_seen_state.sql
-- Motif     : suite de chat_read_status. Les autres repères « vu » vivaient dans
--             localStorage (pastille « nouveaux résultats » de l'Accueil, popups
--             « Pari validé » / « depuis ta dernière visite » / « nouveau
--             badge », cartes de l'Accueil déjà ouvertes) : sur un autre
--             appareil, tout réapparaissait.
--
-- Décisions :
--   - Une table clé/valeur par compte plutôt qu'une table par usage : ces
--     repères sont tous de simples « dernier vu » (date, palier, drapeau).
--     La valeur est du texte (date ISO, "1", ou JSON pour les badges).
--   - Dernière écriture gagnante ; les clients ne font avancer un repère que
--     vers l'avant (dates) avant d'écrire.
--   - Pas d'initialisation des comptes existants : le client reprend d'abord
--     le repère localStorage de l'appareil s'il existe (pont, une seule fois),
--     donc rien ne réapparaît au déploiement.
--   - Realtime : un repère posé sur un appareil se propage aux autres ouverts.
-- ============================================================================

create table user_seen_state (
  user_id uuid not null references users(id) on delete cascade,
  key text not null check (char_length(key) between 1 and 100),
  value text not null check (char_length(value) <= 20000),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table user_seen_state enable row level security;

create policy user_seen_state_all on user_seen_state for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create function set_user_seen_state(p_key text, p_value text) returns void
language sql
as $$
  insert into user_seen_state (user_id, key, value, updated_at)
  values (auth.uid(), p_key, p_value, now())
  on conflict (user_id, key) do update
    set value = excluded.value, updated_at = now();
$$;

alter publication supabase_realtime add table user_seen_state;
