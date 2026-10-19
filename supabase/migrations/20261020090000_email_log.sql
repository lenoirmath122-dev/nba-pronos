-- ============================================================================
-- NBA PRONOS — JOURNAL DES E-MAILS PLANIFIÉS (livraison 1B)
-- ============================================================================
-- Fichier : supabase/migrations/20261020090000_email_log.sql
-- Motif   : e-mails du résultat du matin, de la relance et du rappel du soir.
--           Règle produit : un seul e-mail par jour et par personne (hors mail
--           de validation, envoyé par Supabase Auth). La contrainte unique
--           (user_id, send_date) l'impose en base, quel que soit le nombre de
--           passages du planificateur.
-- ============================================================================

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('RESULT', 'RELANCE', 'REMINDER')),
  send_date date not null, -- jour (Europe/Paris) de l'envoi
  provider_id text,        -- identifiant du message chez Resend
  sent_at timestamptz not null default now(),
  unique (user_id, send_date)
);

-- La relance est unique dans la vie d'un compte en attente.
create unique index email_log_one_relance on public.email_log (user_id) where kind = 'RELANCE';

alter table public.email_log enable row level security;
-- Aucune policy volontairement : seul le job planifié (service_role) lit et écrit.
