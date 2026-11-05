-- ============================================================================
-- NBA PRONOS — E-MAIL DE LA POPUP HEBDOMADAIRE
-- ============================================================================
-- Fichier : supabase/migrations/20261026090000_weekly_popup_email.sql
-- Motif   : doubler la popup du lundi d'un e-mail indépendant, pour retenir les
--           joueurs dont le rythme de pronos baisse. Il déroge volontairement à
--           la règle « un e-mail par jour » d'`email_log` : journal à part,
--           une ligne par (popup, joueur), unique, donc jamais deux envois.
--           `email_requested_at` est posé par la publication (geste manuel de
--           l'admin) ; sans lui, aucun envoi.
-- ============================================================================

alter table public.weekly_popups
  add column if not exists email_requested_at timestamptz;

create table public.weekly_popup_email_log (
  popup_id uuid not null references public.weekly_popups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  provider_id text,        -- identifiant du message chez Resend
  sent_at timestamptz not null default now(),
  primary key (popup_id, user_id)
);

alter table public.weekly_popup_email_log enable row level security;
-- Aucune policy volontairement : seul le service_role lit et écrit.
