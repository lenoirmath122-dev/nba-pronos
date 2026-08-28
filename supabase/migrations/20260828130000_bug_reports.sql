-- ============================================================================
-- NBA PRONOS — V1 — MIGRATION #33 — bug_reports
-- ============================================================================
-- Signalement rapide d'un souci depuis n'importe quel écran (28/08/2026,
-- demandé par l'utilisateur pour l'alpha/bêta -- crainte réelle qu'un petit
-- souci ne remonte jamais par DM, un bouton toujours visible capture ce qui
-- se perdrait sinon). Volontairement minimal : texte libre uniquement, pas
-- de pièce jointe -- le contexte (joueur, écran, heure) est déjà capturé
-- automatiquement, une capture d'écran n'apporte souvent rien pour un petit
-- souci. Distinct de correction_requests (qui conteste un score DÉJÀ
-- calculé, migration #13) : ceci couvre tout le reste (bug d'affichage,
-- confusion UX, idée...), jamais de logique de scoring en jeu.
-- ============================================================================

create type bug_report_status as enum ('OPEN', 'RESOLVED');

create table bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  description text not null,
  screen_path text,                          -- écran d'où vient le signalement (usePathname, best-effort)
  status bug_report_status not null default 'OPEN',
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_admin_id uuid references users(id)
);

alter table bug_reports enable row level security;

-- Lecture : l'auteur voit ses propres signalements, un admin voit tout.
create policy bug_reports_select on bug_reports for select using (
  user_id = auth.uid()
  or public.is_admin()
);

-- Écriture : n'importe quel joueur ACTIVE peut signaler, jamais au nom d'un
-- autre (même garde que le reste de l'app, cf. bets_insert/predictions_insert).
create policy bug_reports_insert on bug_reports for insert with check (
  user_id = auth.uid() and public.is_active()
);

-- Résolution (marquer traité, ajouter une note) : admin seul.
create policy bug_reports_update on bug_reports for update
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- FIN — migration #33.
-- ============================================================================
