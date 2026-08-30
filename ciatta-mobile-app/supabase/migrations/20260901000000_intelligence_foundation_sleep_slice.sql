-- Ciatta Intelligence & Experience Model v0.1 / Expert Council v0.2 —
-- Stage 1 vertical slice. Additive only: nothing here is read by, written
-- by, or removes anything from the existing understanding-engine path.
-- See docs/specs/ciatta-semantic-refactor-spec-v1.md for the full object
-- definitions this migration implements a first slice of.
--
-- Scope: this slice populates these tables for the 'sleep' domain and the
-- 'nightly_sleep_minutes' feature_type only. The schema itself is
-- domain/feature-agnostic so later stages can widen it without another
-- migration to these same tables.

-- ---------------------------------------------------------------------------
-- features: a reproducible value calculated from Observations.
-- ---------------------------------------------------------------------------
create table public.features (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  domain domain_type not null,
  feature_type text not null,
  value numeric not null,
  window_start date,
  window_end date not null,
  observation_ids uuid[] not null default '{}',
  calculation_version text not null,
  computed_at timestamptz not null default now()
);

create index features_user_domain_type_idx
  on public.features (user_id, domain, feature_type, window_end desc);

-- ---------------------------------------------------------------------------
-- baselines: an individual's personal reference value for a Feature.
-- ---------------------------------------------------------------------------
create table public.baselines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  domain domain_type not null,
  feature_type text not null,
  value numeric not null,
  window_start date not null,
  window_end date not null,
  sample_size int not null,
  eligible boolean not null,
  calculation_version text not null,
  computed_at timestamptz not null default now()
);

create index baselines_user_domain_type_idx
  on public.baselines (user_id, domain, feature_type, computed_at desc);

-- ---------------------------------------------------------------------------
-- change_events: difference from an appropriate personal reference,
-- carrying the measured-vs-meaningful distinction the legacy pipeline
-- never persisted.
-- ---------------------------------------------------------------------------
create table public.change_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  domain domain_type not null,
  feature_type text not null,
  feature_id uuid not null references public.features (id) on delete cascade,
  baseline_id uuid not null references public.baselines (id) on delete cascade,
  observed_value numeric not null,
  baseline_value numeric not null,
  deviation numeric not null,
  direction text not null check (direction in ('up', 'down', 'flat')),
  threshold_used numeric not null,
  is_meaningful boolean not null,
  detected_at timestamptz not null default now()
);

create index change_events_user_domain_type_idx
  on public.change_events (user_id, domain, feature_type, detected_at desc);

-- ---------------------------------------------------------------------------
-- patterns: a Relationship or Change demonstrating sufficient recurrence,
-- temporal consistency, persistence/stability, and a checked alternative
-- explanation. Never promoted from correlation alone — see
-- patternEvaluation.ts. threshold_version records which MVP recurrence
-- threshold produced this row, since that threshold is an explicit,
-- configurable operational hypothesis, not a fixed rule.
-- ---------------------------------------------------------------------------
create table public.patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  domain domain_type not null,
  to_domain domain_type,
  pattern_type text not null,
  recurrence_count int not null,
  window_count_required int not null,
  stable_under_removal boolean not null,
  alternative_explanation_checked boolean not null,
  alternative_explanation_ruled_out boolean not null,
  confidence numeric not null,
  confidence_label text not null,
  source_relationship_ids uuid[] not null default '{}',
  threshold_version text not null,
  detected_at timestamptz not null default now(),
  unique (user_id, domain, to_domain, pattern_type)
);

-- ---------------------------------------------------------------------------
-- finding_evidence: information judged sufficiently valid and relevant to
-- support a specific Finding. Named `finding_evidence`, not `evidence` —
-- the legacy `evidence` table (a Feature-shaped aggregate under the old
-- model) still exists and is still written by the live engine during this
-- slice. This table takes over the name `evidence` only once the legacy
-- table is retired in a later stage.
--
-- PROVISIONAL: this flat, single-table shape is an MVP shortcut for one
-- vertical slice, not the final Evidence Ledger architecture. The
-- dedicated Evidence Ledger design (Approval Checkpoint item 8 in
-- docs/specs/ciatta-semantic-refactor-spec-v1.md §5) remains an open
-- architecture decision and must be revisited before broader
-- implementation or cutover. Nothing outside this slice references
-- finding_evidence's internal columns, so normalizing it later is a
-- self-contained migration, not a cross-cutting one.
-- ---------------------------------------------------------------------------
create table public.finding_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  domain domain_type not null,
  feature_ids uuid[] not null default '{}',
  baseline_id uuid references public.baselines (id),
  change_event_id uuid references public.change_events (id),
  relationship_id uuid references public.relationships (id),
  pattern_id uuid references public.patterns (id),
  quality_flags text[] not null default '{}',
  contradictory_evidence text,
  alternative_explanations text[] not null default '{}',
  uncertainty text,
  scientific_basis text,
  permitted_language text[] not null default '{}',
  prohibited_language text[] not null default '{}',
  sufficiency_verdict boolean not null,
  version text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- findings: a specific supported statement produced from a defined
-- Evidence set. Most Findings never reach ciatta_knowledge below.
-- ---------------------------------------------------------------------------
create table public.findings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  domain domain_type not null,
  feature_type text not null,
  statement text not null,
  evidence_id uuid not null references public.finding_evidence (id) on delete cascade,
  confidence_tier strength_type not null,
  safety_tier text not null
    check (safety_tier in ('unacceptable', 'serious', 'manageable', 'low', 'minimal')),
  produced_at timestamptz not null default now()
);

create index findings_user_domain_type_idx
  on public.findings (user_id, domain, feature_type, produced_at desc);

-- ---------------------------------------------------------------------------
-- ciatta_knowledge: information established sufficiently for its intended
-- purpose and permitted to be retained/reused. retention_rule_version
-- records which MVP promotion rule (currently >=2 reproduced runs)
-- produced this row — an explicit, configurable, provisional policy, not
-- a fixed rule.
-- ---------------------------------------------------------------------------
create table public.ciatta_knowledge (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  domain domain_type not null,
  feature_type text not null,
  statement text not null,
  finding_ids uuid[] not null default '{}',
  confidence_tier strength_type not null,
  safety_tier text not null,
  retention_rule_version text not null,
  established_at timestamptz not null default now(),
  last_reconfirmed_at timestamptz not null default now(),
  unique (user_id, domain, feature_type)
);

-- ---------------------------------------------------------------------------
-- Row Level Security — read own, matching every existing intelligence
-- table. All writes are service-role only, from the Edge Function.
-- ---------------------------------------------------------------------------
alter table public.features enable row level security;
alter table public.baselines enable row level security;
alter table public.change_events enable row level security;
alter table public.patterns enable row level security;
alter table public.finding_evidence enable row level security;
alter table public.findings enable row level security;
alter table public.ciatta_knowledge enable row level security;

create policy "features: read own" on public.features
  for select using (auth.uid() = user_id);
create policy "baselines: read own" on public.baselines
  for select using (auth.uid() = user_id);
create policy "change_events: read own" on public.change_events
  for select using (auth.uid() = user_id);
create policy "patterns: read own" on public.patterns
  for select using (auth.uid() = user_id);
create policy "finding_evidence: read own" on public.finding_evidence
  for select using (auth.uid() = user_id);
create policy "findings: read own" on public.findings
  for select using (auth.uid() = user_id);
create policy "ciatta_knowledge: read own" on public.ciatta_knowledge
  for select using (auth.uid() = user_id);
