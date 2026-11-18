-- Mode invité (lot F) : trois événements d'entonnoir et le type d'action
-- (chat, predict, bet, follow, react) qui les accompagne. Toujours aucun
-- identifiant de compte.

alter table public.funnel_events
  add column action_type text check (action_type in ('chat', 'predict', 'bet', 'follow', 'react'));

alter table public.funnel_events drop constraint funnel_events_event_check;
alter table public.funnel_events add constraint funnel_events_event_check check (event in (
  'visit', 'home_view', 'team_picked', 'prono_added', 'save_opened',
  'save_email_submitted', 'save_google_started', 'account_created',
  'account_validated', 'password_created',
  'guest_action_attempted', 'auth_modal_opened', 'action_completed'
));
