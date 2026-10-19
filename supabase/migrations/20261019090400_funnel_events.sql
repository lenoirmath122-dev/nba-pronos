-- Accueil jouable / pronos invités (plan d'attractivité, tâche 11, §1.13) :
-- mesure de l'entonnoir, interne et anonyme. visitor_id est un identifiant
-- aléatoire posé en cookie, sans lien avec un compte. Écriture par une route
-- serveur (client privilégié), lecture réservée aux admins.

create table public.funnel_events (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null check (char_length(visitor_id) between 8 and 64),
  event text not null check (event in (
    'home_view', 'team_picked', 'prono_added', 'save_opened',
    'save_email_submitted', 'save_google_started', 'account_validated', 'password_created'
  )),
  match_id uuid references public.matches(id) on delete set null,
  referrer text check (char_length(referrer) <= 200),
  created_at timestamptz not null default now()
);

create index funnel_events_event_created_idx on public.funnel_events (event, created_at);
create index funnel_events_visitor_idx on public.funnel_events (visitor_id, created_at);

alter table public.funnel_events enable row level security;
create policy funnel_events_select_admin on public.funnel_events for select using (public.is_admin());
