-- ============================================================================
-- NBA PRONOS — RÉCAPS JOURNALIER ET HEBDO (p3-10 + p3-11)
-- ============================================================================
-- Fichier   : supabase/migrations/20261005090000_recaps.sql
-- Motif     : retour de l'alpha (récap journalier, récap hebdo, débrief des
--             matchs de la veille). Récap calculé à la volée (lib/recaps/),
--             affiché en tête de « Ça vient de tomber » sur l'Accueil et
--             poussé chaque matin à 10h (heure de Paris).
-- ============================================================================

-- Interrupteur « Récaps » du Profil. Activé par défaut (choix de
-- l'utilisateur, 05/10/2026) : tout joueur en push les reçoit tant qu'il ne
-- les coupe pas. Indépendant de notification_preference, pour pouvoir garder
-- les rappels de match sans les récaps. Écrit par le joueur via la policy
-- users_update_self existante, aucune policy à ajouter.
alter table users
  add column recap_enabled boolean not null default true;

-- Déduplication des récaps envoyés : un seul push par joueur, par type et
-- par jour de récap, quel que soit le nombre de passages du planificateur
-- (le cron tourne à 8h et 9h UTC pour tomber sur 10h Paris été comme hiver).
-- Table distincte de reminder_log, dont la clé (user_id, kind, ref_id) ne
-- permet qu'un envoi par match/compétition, pas un par jour.
create table recap_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('DAILY', 'WEEKLY')),
  recap_date date not null, -- jour (Europe/Paris) du récap
  sent_at timestamptz not null default now(),
  unique (user_id, kind, recap_date)
);

alter table recap_log enable row level security;
-- Aucune policy créée volontairement (même choix que reminder_log) : seul le
-- job planifié (service_role) lit et écrit cette table.

-- ============================================================================
-- FIN
-- ============================================================================
