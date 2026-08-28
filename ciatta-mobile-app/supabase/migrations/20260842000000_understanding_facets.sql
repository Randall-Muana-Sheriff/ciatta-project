-- Structured Understanding facets. The living interpretation stays one row
-- per domain. Processors already compute these values; this stores them as
-- typed columns instead of burying them in narrative prose.

alter table public.understandings
  add column if not exists seeing text not null default '',
  add column if not exists evidence_summary text,
  add column if not exists evidence_signal text,
  add column if not exists baseline_value numeric,
  add column if not exists baseline_unit text,
  add column if not exists baseline_window_days int,
  add column if not exists baseline_summary text,
  add column if not exists change_detected boolean not null default false,
  add column if not exists change_summary text,
  add column if not exists related_domains text[] not null default '{}';

update public.understandings
set seeing = narrative
where seeing = '' and narrative is not null and narrative <> '';
