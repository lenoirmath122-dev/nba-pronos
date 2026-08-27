-- ============================================================================
-- NBA PRONOS — BADGES ÉPINGLÉS (bandeau du profil)
-- ============================================================================
-- Fichier   : supabase/migrations/20260827090000_pinned_badges.sql
-- Nature    : le joueur choisit jusqu'à 3 badges permanents parmi ceux
--             débloqués (lib/queries/badges.ts) pour les afficher à côté de
--             son pseudo dans le bandeau du profil (BACKLOG_V1.md, cadré le
--             27/08/2026). Choix manuel, pas automatique -- aucune date de
--             déblocage n'est stockée (user_badges_lifetime ne donne que le
--             niveau ATTEINT), donc "les plus récents" n'était pas faisable.
-- Contrainte: les tiers de badges sont des compteurs cumulatifs à vie
--             (jamais de régression, cf. lib/queries/badges.ts) -- un badge
--             épinglé ne peut donc jamais redevenir invalide après coup, pas
--             besoin de trigger de nettoyage.
-- RLS       : aucune migration nécessaire, même note que
--             20260806090000_background_theme.sql -- users_update_self +
--             enforce_users_invariants (migration #3) couvrent déjà toute
--             nouvelle colonne sur users. Le CHECK ci-dessous garde
--             uniquement l'invariant de taille (défense en profondeur,
--             la validation "badge débloqué" reste côté action serveur --
--             pas exprimable simplement en SQL pur).
-- ============================================================================

alter table users
  add column pinned_badge_ids text[] not null default '{}',
  add constraint users_pinned_badge_ids_max3 check (array_length(pinned_badge_ids, 1) is null or array_length(pinned_badge_ids, 1) <= 3);

-- ============================================================================
-- FIN.
-- ============================================================================
