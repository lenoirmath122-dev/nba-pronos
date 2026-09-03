-- ============================================================================
-- NBA PRONOS — SIGNALEMENT DE MESSAGE DE CHAT VERS LES ADMINS
-- ============================================================================
-- Fichier   : supabase/migrations/20260903130000_chat_message_reports.sql
-- Nature    : implémente la décision du cadrage juridique §2.10 point 7
--             (Cadrage/Juridique/conseils_juridiques_deploiement_
--             application.md) : signalement d'un message de chat par un
--             joueur vers les admins, en complément de bug_reports
--             (migration #33) qui ne couvre que les bugs techniques.
-- Patron    : très proche de bug_reports (même structure OPEN/RESOLVED,
--             mêmes 3 policies select/insert/update, pas de fonction SQL
--             SECURITY DEFINER -- écriture directe RLS-gardée).
--
-- Différence avec bug_reports : message_id référence chat_messages, table
-- sur laquelle un admin peut faire un vrai DELETE (chat_messages_delete_
-- admin, migration chat). Un signalement doit survivre à la suppression du
-- message signalé (c'est souvent CE QUI la déclenche) -- d'où le snapshot
-- du texte/auteur au moment du signalement (message_body_snapshot,
-- message_author_id) ET `on delete set null` sur message_id plutôt qu'un
-- `not null` bloquant comme sur bug_reports.user_id.
-- ============================================================================

create type chat_report_status as enum ('OPEN', 'RESOLVED');

create table chat_message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references chat_messages(id) on delete set null,
  message_body_snapshot text not null,
  message_author_id uuid references users(id),
  reporter_user_id uuid not null references users(id),
  reason text not null check (char_length(trim(reason)) between 1 and 500),
  status chat_report_status not null default 'OPEN',
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_admin_id uuid references users(id)
);

alter table chat_message_reports enable row level security;

-- Lecture : l'auteur du signalement voit ses propres signalements, un admin
-- voit tout (même patron que bug_reports_select).
create policy chat_message_reports_select on chat_message_reports for select using (
  reporter_user_id = auth.uid()
  or public.is_admin()
);

-- Écriture : n'importe quel joueur ACTIVE peut signaler, jamais au nom d'un
-- autre (même garde que bug_reports_insert). Le snapshot (body/auteur) est
-- constitué côté serveur (Server Action) à partir du message réellement lu
-- via chat_messages_select -- jamais fait confiance au texte envoyé par le
-- client, pour ne pas laisser un client forgé polluer l'historique admin
-- avec un texte inventé attribué à un message_id réel.
create policy chat_message_reports_insert on chat_message_reports for insert with check (
  reporter_user_id = auth.uid() and public.is_active()
);

-- Résolution (marquer traité, ajouter une note) : admin seul.
create policy chat_message_reports_update on chat_message_reports for update
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- FIN.
-- ============================================================================
