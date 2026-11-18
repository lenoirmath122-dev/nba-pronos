-- ============================================================================
-- NBA PRONOS — ACTUALITÉ : RÉACTIONS RAPIDES AUX HIGHLIGHTS DE LA NUIT
-- ============================================================================
-- Fichier   : supabase/migrations/20261113150000_recap_reactions.sql
-- Motif     : l'onglet Accueil devient « Actualité » (13/11/2026, demandé par
--             l'utilisateur) : on peut réagir d'un tap aux highlights d'une
--             nuit (« Meilleure nuit », « Plus gros pari réussi »).
--
-- Décisions :
--   - Un highlight est identifié par (compétition, jour du récap, cible) :
--     les highlights sont recalculés à la lecture (lib/recaps/build.ts), ils
--     n'ont pas de ligne en base à laquelle se rattacher.
--   - UNE réaction par joueur et par highlight (même règle que le chat) :
--     toucher l'autre réaction la remplace, retoucher la même la retire.
--   - Jeu fixe, contraint en base ; la liste côté UI vit dans
--     lib/recaps/reactions.ts (à garder alignée).
--   - Lecture : tout joueur connecté (les récaps sont lisibles par tous les
--     joueurs de la compétition). Écriture : sa propre ligne, compte actif.
--   - Pas de Realtime ni de notification : compteurs relus au chargement.
-- ============================================================================

create table recap_reactions (
  competition_id uuid not null references competitions(id) on delete cascade,
  recap_date date not null,
  target text not null check (target in ('TOP_SCORERS', 'BEST_BET')),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('RESPECT', 'CHAMBRER')),
  created_at timestamptz not null default now(),
  primary key (competition_id, recap_date, target, user_id)
);

create index recap_reactions_day_idx on recap_reactions (competition_id, recap_date);

alter table recap_reactions enable row level security;

create policy recap_reactions_select on recap_reactions for select using (
  auth.uid() is not null
);

create policy recap_reactions_insert on recap_reactions for insert with check (
  user_id = auth.uid() and public.is_active()
);

create policy recap_reactions_update on recap_reactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_active());

create policy recap_reactions_delete on recap_reactions for delete using (
  user_id = auth.uid()
);
