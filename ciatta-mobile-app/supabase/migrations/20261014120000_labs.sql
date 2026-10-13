-- Labs: every lab result in one table, whichever way it arrived.
--
--   provider  sent by a hospital she connected (FHIR Observation)
--   report    read from a photo or PDF of a lab report, checked by her
--
-- source is null only for a row written before this migration; the app
-- always says which.
--
-- The lab's printed range is kept as numbers when it is one, and as the
-- lab's own words always (reference_text), because "<5" and "Negative" are
-- ranges too. flag is the lab's own interpretation, as an HL7
-- ObservationInterpretation code; Ciatta never writes one the lab did not.
alter table public.results
  add column reference_text text,
  add column flag text check (flag in ('N', 'H', 'L', 'HH', 'LL', 'A', 'AA')),
  add column status text,
  add column source text check (source in ('provider', 'report')),
  add column source_ref text,
  -- A provider result carries its connection and resource id here, so a
  -- re sync updates it rather than adding it again. Nulls are distinct, so
  -- results read from a report are never constrained.
  add constraint results_user_source_ref unique (user_id, source_ref);

create index results_user_test on public.results (user_id, test_name, occurred_at desc);

-- At most 20 lab report scans per person per day, counted before the
-- model is called, as with meals.
create table public.lab_scan_uses (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);
alter table public.lab_scan_uses enable row level security;
revoke all on public.lab_scan_uses from anon, authenticated;
grant all on public.lab_scan_uses to service_role;

create function public.claim_lab_scan() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  used integer;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.lab_scan_uses (user_id, day, count) values (me, current_date, 1)
  on conflict (user_id, day) do update set count = public.lab_scan_uses.count + 1
  returning count into used;
  return used <= 20;
end $$;
revoke execute on function public.claim_lab_scan() from public, anon;
grant execute on function public.claim_lab_scan() to authenticated;
