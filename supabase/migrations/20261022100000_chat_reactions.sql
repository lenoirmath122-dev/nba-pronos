-- ============================================================================
-- NBA PRONOS — CHAT : RÉACTIONS EMOJI AUX MESSAGES
-- ============================================================================
-- Fichier   : supabase/migrations/20261022100000_chat_reactions.sql
-- Motif     : réactions façon Messenger sur les messages du chat (22/10/2026).
--
-- Décisions :
--   - UNE réaction par joueur et par message (PK message_id + user_id) :
--     toucher un autre emoji remplace la réaction, retoucher le même la retire.
--   - Jeu d'emojis fixe (👍 ❤️ 😂 😮 😢 🔥), contraint en base ; la liste
--     côté UI vit dans lib/chat/reactions.ts (à garder alignée).
--   - Pas de notification de réaction.
--   - Visibilité : une réaction est lisible/posable seulement si le message
--     l'est (sous-requête sur chat_messages, donc RLS chat_messages_select
--     appliquée : Général ouvert, ligue réservée aux membres).
--   - Realtime : la PK (message_id, user_id) est l'identité de réplique par
--     défaut, donc un événement DELETE porte de quoi retirer la pastille.
-- ============================================================================

create table chat_message_reactions (
  message_id uuid not null references chat_messages(id) on delete cascade,
  user_id uuid not null references users(id),
  emoji text not null check (emoji in ('👍', '❤️', '😂', '😮', '😢', '🔥')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table chat_message_reactions enable row level security;

create policy chat_message_reactions_select on chat_message_reactions for select using (
  message_id in (select id from chat_messages)
);

create policy chat_message_reactions_insert on chat_message_reactions for insert with check (
  user_id = auth.uid()
  and public.is_active()
  and message_id in (select id from chat_messages)
);

create policy chat_message_reactions_update on chat_message_reactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_active());

create policy chat_message_reactions_delete on chat_message_reactions for delete using (
  user_id = auth.uid()
);

alter publication supabase_realtime add table chat_message_reactions;
