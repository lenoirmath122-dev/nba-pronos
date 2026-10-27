-- Entonnoir de l'accueil (suite de 20261019090400) : source de la visite et
-- fin d'entonnoir côté serveur. Toujours aucun identifiant de compte.
--  - utm_* : paramètres du lien d'arrivée (minuscules, [a-z0-9_.-]), validés côté serveur ;
--  - in_app_browser : famille du navigateur intégré, déduite du User-Agent (jamais stocké en entier) ;
--  - account_created : écrit par le serveur à la création du compte.

alter table public.funnel_events
  add column utm_source text check (char_length(utm_source) <= 100),
  add column utm_medium text check (char_length(utm_medium) <= 100),
  add column utm_campaign text check (char_length(utm_campaign) <= 100),
  add column utm_content text check (char_length(utm_content) <= 100),
  add column in_app_browser text check (char_length(in_app_browser) <= 20);

alter table public.funnel_events drop constraint funnel_events_event_check;
alter table public.funnel_events add constraint funnel_events_event_check check (event in (
  'home_view', 'team_picked', 'prono_added', 'save_opened',
  'save_email_submitted', 'save_google_started', 'account_created',
  'account_validated', 'password_created'
));

create index funnel_events_utm_source_idx on public.funnel_events (utm_source, created_at);
