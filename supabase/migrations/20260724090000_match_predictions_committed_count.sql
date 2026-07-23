-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #6 — COMPTEUR "X/N ONT PRONOSTIQUÉ" UNIVERSEL
-- ============================================================================
-- Fichier : supabase/migrations/20260724090000_match_predictions_committed_count.sql
-- Motif   : SPEC_ECRAN_MATCHS_V0_1.md §8 exige un compteur "X/N ont pronostiqué"
--           visible EN PERMANENCE, pour tout le monde — pas seulement pour un
--           joueur qui a déjà validé sur CE match précis. match_predictions_select
--           (T3) ne laisse voir la ligne d'un autre joueur qu'après verrouillage
--           OU commitment mutuel sur LE MÊME match (has_committed_prediction) —
--           un simple count(*) en session joueur sous-compte donc X tant que
--           l'appelant n'a pas lui-même validé sur ce match précis. Même défaut
--           que celui corrigé la veille sur le Classement (migration #5), ici à
--           l'échelle d'un match plutôt que d'une compétition entière.
-- Mécanisme : fonction SECURITY DEFINER, même principe que has_committed_prediction()
--           déjà en base (T3 §2) — ne renvoie QU'UN ENTIER, aucune ligne, aucun
--           contenu. « Qui a pronostiqué quoi » reste caché tant que isRevealed
--           est faux (§8) : cette fonction ne change rien à cette confidentialité,
--           elle expose uniquement un compte.
-- ============================================================================

create function public.count_committed_predictions(p_match uuid) returns int
language sql security definer stable set search_path = public as $$
  select count(*)::int
  from match_predictions
  where match_id = p_match and status <> 'DRAFT';
$$;

-- ============================================================================
-- FIN — migration #6. Aucune policy RLS modifiée ; match_predictions reste
-- aussi confidentielle qu'avant pour le CONTENU. Seul le COMPTE devient public.
-- ============================================================================
