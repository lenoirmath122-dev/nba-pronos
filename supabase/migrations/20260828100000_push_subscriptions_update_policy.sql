-- ============================================================================
-- NBA PRONOS — V1 — CORRECTIF — policy UPDATE manquante sur push_subscriptions
-- ============================================================================
-- Fichier   : supabase/migrations/20260828100000_push_subscriptions_update_policy.sql
-- Motif     : savePushSubscription() (lib/actions/notifications.ts) fait un
--             upsert (onConflict: user_id,endpoint) sur push_subscriptions.
--             La migration d'origine (20260729100000_push_notifications.sql)
--             n'a créé que SELECT/INSERT/DELETE -- la branche ON CONFLICT DO
--             UPDATE de l'upsert n'a donc aucune policy applicable. Passe
--             inaperçu au tout premier abonnement (simple INSERT, pas de
--             conflit) mais échoue dès qu'on réactive les notifications
--             alors qu'un abonnement existe déjà pour cet appareil (même
--             endpoint, réutilisé par ensurePushSubscribed()) : erreur RLS
--             "new row violates row-level security policy (USING expression)
--             for table push_subscriptions". Repéré en réactivant les
--             notifications d'un canal de chat (28/08/2026).
-- ============================================================================

create policy push_subscriptions_update on push_subscriptions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================================
-- FIN — correctif.
-- ============================================================================
