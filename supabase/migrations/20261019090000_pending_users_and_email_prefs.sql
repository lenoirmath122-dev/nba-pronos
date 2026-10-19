-- Accueil jouable / pronos invités (plan d'attractivité, tâche 2).
-- Un compte créé par e-mail reste PENDING jusqu'au clic dans le mail de
-- validation. Les préférences e-mail s'ajoutent à notification_preference
-- (un seul canal) : le push reste géré par push_subscriptions.

alter type user_status add value if not exists 'PENDING';

-- Défaut du rappel du soir : décision 1.12 non tranchée, donc décoché
-- (cas prudent). À repasser à true si la décision va dans l'autre sens.
alter table public.users
  add column if not exists email_results_enabled boolean not null default true,
  add column if not exists email_reminders_enabled boolean not null default false;

-- Les comptes existants gardent leur choix de récap du matin.
update public.users set email_results_enabled = recap_enabled;
