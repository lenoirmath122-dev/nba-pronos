-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #32 — NOTIFICATIONS DE CHAT (mute par canal)
-- ============================================================================
-- Fichier   : supabase/migrations/20260827120000_chat_notifications.sql
-- Motif     : suite directe de la migration #31 (chat_messages) -- demande de
--             l'utilisateur le jour même : liste de canaux (au lieu des
--             chips), notifications activables/désactivables par canal via un
--             menu "..." en bout de ligne.
--
-- Décisions actées AVEC l'utilisateur (27/08/2026, AskUserQuestion) :
--   - Contenu de la notif : aperçu (pseudo + début du message), pas
--     générique.
--   - Par défaut : ACTIVÉES pour tout canal accessible (Général dès la
--     création du compte, une ligue dès qu'on la rejoint) -- donc cette
--     table ne stocke que les EXCEPTIONS (canaux mis en sourdine), pas une
--     ligne par canal actif. Absence de ligne = notifications actives.
--
-- Modèle : même patron de cohérence scope_type/league_id + index partiels
-- que chat_messages (migration #31). PAS de contrainte PRIMARY KEY
-- composite sur (user_id, scope_type, league_id) -- league_id est NULLABLE
-- pour GLOBAL, or une clé primaire composite exige NOT NULL sur toutes ses
-- colonnes ; 2 index uniques partiels (un par scope) à la place.
-- ============================================================================

create table chat_muted_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  scope_type text not null check (scope_type in ('GLOBAL', 'LEAGUE')),
  league_id uuid references leagues(id) on delete cascade,
  muted_at timestamptz not null default now(),
  constraint chat_muted_scope_consistency check (
    (scope_type = 'GLOBAL' and league_id is null)
    or (scope_type = 'LEAGUE' and league_id is not null)
  )
);

create unique index idx_chat_muted_global on chat_muted_channels (user_id) where scope_type = 'GLOBAL';
create unique index idx_chat_muted_league on chat_muted_channels (user_id, league_id) where scope_type = 'LEAGUE';

alter table chat_muted_channels enable row level security;

-- Entièrement self-service : chacun ne voit/gère que ses propres sourdines
-- (même patron `for all` que competition_secrets_all, migration #3). Le
-- calcul des DESTINATAIRES d'une notif (lib/push/notifyChatMessage.ts) lit
-- cette table via service_role -- volontairement PAS via une policy select
-- élargie, pour ne pas exposer "qui a mute quoi" à un autre joueur.
create policy chat_muted_channels_all on chat_muted_channels for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================================
-- FIN — migration #32.
-- Vérif post-push : insert/delete d'une sourdine par son propriétaire (OK) ;
-- lecture des sourdines d'un AUTRE compte (0 ligne, RLS) ; double mute du
-- même canal (rejeté par l'index unique partiel, géré comme idempotent côté
-- lib/actions/chat.ts) ; démute (delete) puis remute -- pas de doublon.
-- ============================================================================
