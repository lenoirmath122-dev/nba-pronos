-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #15 — RAPPELS CIBLÉS (push, BACKLOG_V1.md)
-- ============================================================================
-- Fichier   : supabase/migrations/20260729100000_push_notifications.sql
-- Motif     : backlog "Rappels ciblés" (PRIORITÉ) — « tu n'as pas encore
--             pronostiqué le match de ce soir », « la deadline du bracket
--             approche ». Canal choisi AVEC l'utilisateur : Web Push
--             d'abord (aucun prérequis externe), Email plus tard (bloqué
--             sur un nom de domaine vérifié pour un SMTP personnalisé —
--             voir GAPS_OUVERTS.md « Confirm email »). Le modèle de
--             préférence couvre déjà les deux canaux pour ne pas le refaire.
-- ============================================================================

create type notification_channel as enum ('NONE', 'PUSH', 'EMAIL');

alter table users
  add column notification_preference notification_channel not null default 'NONE';

-- Abonnements Web Push (§ w3c PushSubscription) — un joueur peut avoir
-- plusieurs appareils/navigateurs, chacun sa propre souscription.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null,
  p256dh_key text not null,
  auth_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table push_subscriptions enable row level security;

-- Le joueur gère SES PROPRES abonnements (créés/retirés depuis Profil) ;
-- l'envoi (service_role, job planifié) contourne la RLS comme les autres
-- écritures système (T4 §9, même famille que sync_logs).
create policy push_subscriptions_select on push_subscriptions for select
  using (user_id = auth.uid());
create policy push_subscriptions_insert on push_subscriptions for insert
  with check (user_id = auth.uid());
create policy push_subscriptions_delete on push_subscriptions for delete
  using (user_id = auth.uid());

-- Déduplication des rappels déjà envoyés (un match/une deadline ne doit
-- déclencher qu'UN SEUL envoi par joueur, quel que soit le nombre de
-- passages du planificateur). Purement interne : aucune policy joueur,
-- lu/écrit uniquement par le job (service_role).
create table reminder_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('MATCH_TONIGHT', 'BRACKET_DEADLINE')),
  ref_id uuid not null, -- matches.id ou competitions.id selon `kind`
  sent_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);

alter table reminder_log enable row level security;
-- Aucune policy créée volontairement : RLS active + 0 policy = 0 accès pour
-- tout rôle authentifié (anon/authenticated), seul service_role la
-- contourne. Aucun écran ne doit jamais lire cette table.

-- ============================================================================
-- FIN — migration #15.
-- ============================================================================
