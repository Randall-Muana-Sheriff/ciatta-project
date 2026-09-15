-- Fix round 2: replace the additive grants from 20260915100300's item 9
-- with exact ones. That migration granted without revoking first, so its
-- narrow grants only ever add privileges on top of whatever an environment's
-- own defaults already handed anon/authenticated -- they never take any
-- away. Locally that default is just TRUNCATE, REFERENCES, TRIGGER and
-- MAINTAIN (auto_expose_new_tables is off), so it was harmless here. But a
-- hosted project's legacy default privileges can hand a brand new table ALL
-- of select/insert/update/delete/etc. before this migration ever runs --
-- RLS still blocks every row today either way, but this migration must not
-- rely on either environment's defaults for what a role can and cannot do
-- at the table level. Revoke everything first, then grant back exactly what
-- each table's own RLS policies allow.

revoke all on
  public.profiles, public.health_sources, public.raw_inputs, public.episodes,
  public.journal_entries, public.medications, public.supplements,
  public.documents, public.results, public.observations,
  public.cycle_events, public.pain_events
  from anon, authenticated;

-- authenticated gets exactly the operations its own policies allow.
grant select, update on public.profiles to authenticated;
grant select, insert on public.observations to authenticated;
grant select on public.cycle_events, public.pain_events to authenticated;
grant select, insert, update, delete on
  public.health_sources, public.raw_inputs, public.episodes, public.journal_entries,
  public.medications, public.supplements, public.documents, public.results
  to authenticated;

-- anon has no policy anywhere in this schema, and now has no table grant
-- either: every read or write is a permission error (42501), not an
-- RLS-empty result.

-- The server (from Slice 2 on) reaches Postgres as service_role, which
-- bypasses RLS entirely and needs the underlying grant to do anything.
-- Hosted projects set this up already; the local stack does not.
grant all on
  public.profiles, public.health_sources, public.raw_inputs, public.episodes,
  public.journal_entries, public.medications, public.supplements,
  public.documents, public.results, public.observations,
  public.cycle_events, public.pain_events
  to service_role;

-- Keep any future table or view in this schema off anon/authenticated by
-- default, so this exact-grants fix cannot regress the next time somebody
-- adds a table and forgets its own explicit grants. This mirrors what
-- auto_expose_new_tables already does locally (a no-op here -- there is
-- nothing for postgres's default privileges to revoke), but is a real fix
-- on a hosted project whose legacy default privileges still hand new tables
-- (and views) ALL.
alter default privileges in schema public revoke all on tables from anon, authenticated;
