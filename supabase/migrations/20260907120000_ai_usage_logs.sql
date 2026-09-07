-- ai_usage_logs (p1-8, feuille de route Phase 1) -- traçabilité + plafond
-- de dépense sur les appels Claude de structuration IA (structureBet.ts et
-- les 8 schémas dédiés, un appel synchrone par pari soumis, cf.
-- SPEC_TECHNIQUE_PROBA_PARIS_PERSOS_V0_1.md §3). Même patron que sync_logs
-- (B3) : écrit en best-effort via service_role (lib/ai/usageTracking.ts),
-- lu par l'admin seul. estimated_cost_usd calculé côté application depuis
-- la tarification du modèle (pas de table de tarifs en base, gardé simple
-- -- à revoir si un 2e modèle est introduit en prod).
create table ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  call_site text not null,          -- nom de la fonction structure*Bet() appelante, pour diagnostic
  model text not null,
  input_tokens integer not null,
  output_tokens integer not null,
  cache_read_tokens integer not null default 0,
  cache_creation_tokens integer not null default 0,
  estimated_cost_usd numeric not null,
  created_at timestamptz not null default now()
);

create index idx_ai_usage_logs_created on ai_usage_logs (created_at desc);

alter table ai_usage_logs enable row level security;
create policy ai_usage_select on ai_usage_logs for select using (public.is_admin());
-- (inserts via service_role, même geste que sync_logs.)
