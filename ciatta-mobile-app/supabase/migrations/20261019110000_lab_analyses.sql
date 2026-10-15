-- The clinical AI analysis of a report she added. Written only by the
-- lab-analysis function, after it has checked every value against her
-- record, through store_lab_analysis below. She can read her own; nothing
-- the app sends can write one.

create table public.lab_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  model text not null,
  facts_hash text not null,
  analysis jsonb not null,
  created_at timestamptz not null default now()
);
create index lab_analyses_document on public.lab_analyses (document_id, created_at desc);
alter table public.lab_analyses enable row level security;
create policy lab_analyses_own on public.lab_analyses for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.lab_analyses from anon, authenticated;
grant select on public.lab_analyses to authenticated;
grant all on public.lab_analyses to service_role;

-- At most 20 analyses per person per day, counted before the model is
-- called, as with lab scans.
create table public.lab_analysis_uses (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);
alter table public.lab_analysis_uses enable row level security;
revoke all on public.lab_analysis_uses from anon, authenticated;
grant all on public.lab_analysis_uses to service_role;

create function public.claim_lab_analysis() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  used integer;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.lab_analysis_uses (user_id, day, count) values (me, current_date, 1)
  on conflict (user_id, day) do update set count = public.lab_analysis_uses.count + 1
  returning count into used;
  return used <= 20;
end $$;
revoke execute on function public.claim_lab_analysis() from public, anon;
grant execute on function public.claim_lab_analysis() to authenticated;

-- Definer because authenticated has no insert on lab_analyses, and must
-- not: an analysis the app could write would be model text nobody checked.
-- The function calls this as her, so auth.uid() is her, and the report
-- must be hers.
create function public.store_lab_analysis(p_document uuid, p_model text, p_facts_hash text, p_analysis jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  new_id uuid;
begin
  if me is null or not exists (select 1 from public.documents where id = p_document and user_id = me) then
    raise exception 'not her report' using errcode = '42501';
  end if;
  insert into public.lab_analyses (user_id, document_id, model, facts_hash, analysis)
  values (me, p_document, p_model, p_facts_hash, p_analysis)
  returning lab_analyses.id into new_id;
  return new_id;
end $$;
revoke execute on function public.store_lab_analysis(uuid, text, text, jsonb) from public, anon;
grant execute on function public.store_lab_analysis(uuid, text, text, jsonb) to authenticated;
