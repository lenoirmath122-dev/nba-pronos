-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #29 — « SUPPRIMER » UN PARI (encore modifiable)
-- ============================================================================
-- Fichier : supabase/migrations/20260818090000_delete_bet_function.sql
-- Motif   : demande utilisateur (18/08/2026) — pouvoir retirer un pari
--           personnalise encore modifiable (DRAFT/SUBMITTED) depuis Mes paris.
--
-- AUCUN DELETE reel : la retention D2 (SPEC_TECHNIQUE_V0.1_1.md §7,
-- « Aucune suppression, nulle part » — pas de backup sur le plan gratuit,
-- effacer et le regretter est irrecuperable) interdit d'ecrire un vrai DELETE
-- sur `bets`. Ce que le joueur voit comme « Supprimer » est en realite un
-- passage a CANCELLED : la ligne reste en base, sort de la liste "En cours"
-- (ONGOING_STATUSES, lib/queries/my-bets.ts) et libere son slot de quota
-- (RELEASED_BET_STATUSES inclut deja CANCELLED, lib/labels/bets.ts) — sans
-- migration ni changement cote lecture. Ce cas etait deja anticipe (commentaire
-- de 20260809090000_badges_lifetime_view.sql : « un pari retire par le joueur »),
-- juste jamais relie a un bouton jusqu'ici.
--
-- Transition DRAFT/SUBMITTED -> CANCELLED deja legale dans
-- enforce_bet_transitions (migration #13, 20260728120000) — aucun changement
-- de trigger necessaire. resolved_at / resolved_by_admin_id restent NULL
-- (aucun admin implique) : ca a pour effet voulu de ne PAS faire apparaitre
-- ce retrait dans le feed « Ca vient de tomber » de l'Accueil (getFeed exige
-- resolved_at non NULL pour un bet_resolved). resolution_reason porte un
-- libelle dedie pour se distinguer d'une neutralisation admin, si un jour
-- l'admin en produit une (aucun flux ne le fait a ce jour — grep confirme).
--
-- Meme patron que save_bet/withdraw_bet (migration #9) : SECURITY DEFINER,
-- reproduit lui-meme tous les garde-fous (auth, propriete, statut), rien
-- delegue a la RLS (`bets` n'a toujours aucune policy DELETE, et n'en aura
-- pas — c'est precisement le point de cette fonction).
-- ============================================================================

create or replace function public.delete_bet(p_bet_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_existing bets%rowtype;
  v_updated_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  select * into v_existing from bets where id = p_bet_id;
  if v_existing.id is null then
    raise exception 'Pari introuvable';
  end if;
  if v_existing.user_id <> v_user_id then
    raise exception 'Ce pari ne t''appartient pas';
  end if;
  if v_existing.status not in ('DRAFT', 'SUBMITTED') then
    raise exception 'Ce pari n''est plus modifiable, donc plus supprimable.';
  end if;

  update bets set
    status = 'CANCELLED',
    resolution_reason = 'Retire par toi avant revue.'
  where id = p_bet_id and user_id = v_user_id and status in ('DRAFT', 'SUBMITTED')
  returning id into v_updated_id;

  if v_updated_id is null then
    raise exception 'Ecriture refusee : aucune ligne affectee (conflit concurrent)';
  end if;
end;
$$;

-- ============================================================================
-- FIN.
-- Verif post-push : supprimer un DRAFT -> disparait de "En cours", apparait
-- dans "Termines" en Neutralise avec le motif dedie ; meme test sur un
-- SUBMITTED ; supprimer un pari deja VALIDATED doit echouer ("plus
-- supprimable") ; supprimer le pari d'un AUTRE joueur doit echouer
-- ("ne t'appartient pas") ; le slot libere doit permettre un nouveau pari sur
-- la meme cible juste apres.
-- ============================================================================
