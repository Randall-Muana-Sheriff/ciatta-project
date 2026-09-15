-- Fix round 1: close the gaps a review found in the identity, record and
-- observation migrations. Every clause below narrows something that was
-- too permissive; nothing here changes what a legitimate save looks like.

-- 1. These functions only exist to be called by triggers or by other
-- definer functions. Left at their default grant, PostgREST would let any
-- signed in (or anonymous) caller invoke them directly -- you_source(uid)
-- would hand back a stranger's own-report source id for any uid supplied.
revoke execute on function public.you_source(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.episode_observations() from public, anon, authenticated;
revoke execute on function public.journal_observations() from public, anon, authenticated;

-- 2. Provenance says who is vouching for a row. A client may report,
-- import or record what it directly measured or was told; only the server
-- gets to say a value was derived, inferred or drawn from research.
alter table public.episodes
  add constraint episodes_provenance_client_check
  check (provenance in ('MEASURED', 'REPORTED', 'RECORDED', 'IMPORTED'));
alter table public.journal_entries
  add constraint journal_entries_provenance_client_check
  check (provenance in ('MEASURED', 'REPORTED', 'RECORDED', 'IMPORTED'));
alter table public.medications
  add constraint medications_provenance_client_check
  check (provenance in ('MEASURED', 'REPORTED', 'RECORDED', 'IMPORTED'));
alter table public.supplements
  add constraint supplements_provenance_client_check
  check (provenance in ('MEASURED', 'REPORTED', 'RECORDED', 'IMPORTED'));
alter table public.documents
  add constraint documents_provenance_client_check
  check (provenance in ('DOCUMENT', 'IMPORTED', 'REPORTED'));
alter table public.results
  add constraint results_provenance_client_check
  check (provenance in ('MEASURED', 'RECORDED', 'IMPORTED', 'DOCUMENT'));
-- raw_inputs has no provenance column: it is always what she typed, said,
-- selected or photographed, and that is already captured by input_mode.

-- 3. A source_id was never checked against its own row's user_id, so
-- (in principle) a row could point at somebody else's source. Every table
-- that carries a source_id now requires it to belong to the same user.
alter table public.health_sources
  add constraint health_sources_id_user_id_key unique (id, user_id);

do $$
declare t text;
begin
  foreach t in array array['episodes', 'journal_entries', 'medications', 'supplements', 'documents', 'results', 'observations'] loop
    execute format('alter table public.%I drop constraint %I', t, t || '_source_id_fkey');
    execute format(
      'alter table public.%I add constraint %I foreign key (source_id, user_id) references public.health_sources (id, user_id) on delete set null (source_id)',
      t, t || '_source_id_user_id_fkey'
    );
  end loop;
end $$;

-- 4. Deleting the account cascades auth.users -> health_sources; that
-- delete then sets any episode's or note's source_id to null, which is an
-- UPDATE and used to always rewrite observations -- for a user whose
-- account is mid-deletion. Both triggers now skip regeneration entirely
-- when none of the columns that feed an observation actually changed, so
-- a source_id-only update (or any other unrelated column) is a no-op here.
create or replace function public.episode_observations() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  src uuid;
  s text;
begin
  if tg_op = 'UPDATE'
     and new.kinds is not distinct from old.kinds
     and new.period_start is not distinct from old.period_start
     and new.flow is not distinct from old.flow
     and new.severity is not distinct from old.severity
     and new.locations is not distinct from old.locations
     and new.stool is not distinct from old.stool
     and new.symptoms is not distinct from old.symptoms
     and new.occurred_at is not distinct from old.occurred_at
     and new.provenance is not distinct from old.provenance
  then
    return new;
  end if;

  delete from public.observations where origin_table = 'episodes' and origin_id = old.id and user_id = old.user_id;
  if tg_op = 'DELETE' then return old; end if;

  src := public.you_source(new.user_id);

  if new.period_start is not null then
    insert into public.observations (user_id, domain, metric, value_text, occurred_at, source_id, provenance, origin_table, origin_id, dedupe_key)
    values (new.user_id, 'cycle', 'period_start', new.period_start::text, new.occurred_at, src, new.provenance, 'episodes', new.id, 'episodes:' || new.id || ':period_start');
  end if;
  if new.flow is not null then
    insert into public.observations (user_id, domain, metric, value_text, occurred_at, source_id, provenance, origin_table, origin_id, dedupe_key)
    values (new.user_id, 'cycle', 'flow', new.flow, new.occurred_at, src, new.provenance, 'episodes', new.id, 'episodes:' || new.id || ':flow');
  end if;
  if 'Pain' = any (new.kinds) then
    insert into public.observations (user_id, domain, metric, value, value_text, unit, occurred_at, source_id, provenance, origin_table, origin_id, dedupe_key)
    values (new.user_id, 'pain', 'pain_episode', new.severity, coalesce(nullif(array_to_string(new.locations, ', '), ''), 'Reported'),
            case when new.severity is null then null else 'of 10' end,
            new.occurred_at, src, new.provenance, 'episodes', new.id, 'episodes:' || new.id || ':pain_episode');
  end if;
  if new.stool is not null then
    insert into public.observations (user_id, domain, metric, value, unit, occurred_at, source_id, provenance, origin_table, origin_id, dedupe_key)
    values (new.user_id, 'gut', 'stool_type', new.stool, 'Bristol type', new.occurred_at, src, new.provenance, 'episodes', new.id, 'episodes:' || new.id || ':stool_type');
  end if;
  -- 5. A duplicate or null/blank symptom used to break the unique
  -- (user_id, dedupe_key) constraint (two symptoms of '' or the same
  -- name collide on the same dedupe_key). Distinct, non-blank symptoms only.
  for s in select distinct sy from unnest(new.symptoms) sy where sy is not null and sy <> '' loop
    insert into public.observations (user_id, domain, metric, value_text, occurred_at, source_id, provenance, origin_table, origin_id, dedupe_key)
    values (new.user_id, 'symptom', 'symptom', s, new.occurred_at, src, new.provenance, 'episodes', new.id, 'episodes:' || new.id || ':symptom:' || s);
  end loop;
  return new;
end $$;

create or replace function public.journal_observations() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE'
     and new.text is not distinct from old.text
     and new.occurred_at is not distinct from old.occurred_at
     and new.provenance is not distinct from old.provenance
  then
    return new;
  end if;

  delete from public.observations where origin_table = 'journal_entries' and origin_id = old.id and user_id = old.user_id;
  if tg_op = 'DELETE' then return old; end if;
  insert into public.observations (user_id, domain, metric, value_text, occurred_at, source_id, provenance, origin_table, origin_id, dedupe_key)
  values (new.user_id, 'context', 'note', new.text, new.occurred_at, public.you_source(new.user_id), new.provenance,
          'journal_entries', new.id, 'journal_entries:' || new.id);
  return new;
end $$;

-- 8. A document's storage_path must live under its own owner's folder --
-- the same folder Storage's RLS policies already require for the file
-- itself, so the row and the file it points at cannot disagree about whose it is.
alter table public.documents
  add constraint documents_storage_path_owned
  check (storage_path like user_id::text || '/%');

-- 9. `supabase test db` caught what a review of the SQL alone could not:
-- every table and view above enforces its rules through RLS policies, but
-- RLS only narrows rows a role can already reach -- the Data API role still
-- needs the base table/view grant, and this CLI's local default no longer
-- hands new `public` entities to anon/authenticated automatically
-- (auto_expose_new_tables is off; see supabase/config.toml). Without these,
-- every one of her own reads and writes failed with permission denied
-- before RLS was ever evaluated. authenticated gets exactly the operations
-- its owner policies allow; anon gets select only, so the anon-reads-nothing
-- assertions see an RLS-empty result rather than a permission error -- there
-- is no anon policy anywhere, so every row stays hidden either way.
grant select, insert, update, delete on
  public.health_sources, public.raw_inputs, public.episodes, public.journal_entries,
  public.medications, public.supplements, public.documents, public.results
  to authenticated;
grant select on
  public.health_sources, public.raw_inputs, public.episodes, public.journal_entries,
  public.medications, public.supplements, public.documents, public.results
  to anon;

-- profiles: only ever selected or updated as her; the row is created by the
-- handle_new_user trigger, which runs with the definer's own privileges.
grant select, update on public.profiles to authenticated;
grant select on public.profiles to anon;

-- observations: only ever selected, or inserted under the client-provenance
-- check; DERIVED rows are written by the observation triggers as the
-- (security definer) function owner, not as authenticated.
grant select, insert on public.observations to authenticated;
grant select on public.observations to anon;

-- cycle_events / pain_events: a view is its own grantable object.
-- security_invoker makes each check her RLS on episodes, but the view
-- itself still needs the Data API role's grant, same as any other table.
grant select on public.cycle_events, public.pain_events to authenticated;
