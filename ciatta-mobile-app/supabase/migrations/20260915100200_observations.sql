-- The common language the intelligence reads. Domain tables stay the rich record;
-- each of their rows writes its observations here in the same transaction.

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  domain text not null,
  metric text not null,
  value numeric,
  value_text text,
  unit text,
  occurred_at timestamptz not null,
  source_id uuid references public.health_sources (id) on delete set null,
  provenance public.provenance not null,
  data_quality text not null default 'ok' check (data_quality in ('ok', 'partial', 'low')),
  origin_table text,
  origin_id uuid,
  dedupe_key text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dedupe_key),
  check (value is not null or value_text is not null)
);
create index observations_metric on public.observations (user_id, domain, metric, occurred_at desc);
create index observations_origin on public.observations (origin_table, origin_id);
create index observations_source on public.observations (source_id);

alter table public.observations enable row level security;
create policy "owner select" on public.observations for select to authenticated
  using (user_id = (select auth.uid()));
create policy "owner adds facts" on public.observations for insert to authenticated
  with check (user_id = (select auth.uid()) and provenance in ('MEASURED', 'REPORTED', 'RECORDED', 'IMPORTED'));
create trigger observations_touch before update on public.observations
  for each row execute function public.touch_updated_at();

create function public.you_source(uid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.health_sources where user_id = uid and kind = 'user_report' order by created_at limit 1
$$;

-- Runs with definer rights because the row that fired it already passed her RLS.
create function public.episode_observations() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  src uuid;
  s text;
begin
  delete from public.observations where origin_table = 'episodes' and origin_id = old.id;
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
  foreach s in array new.symptoms loop
    insert into public.observations (user_id, domain, metric, value_text, occurred_at, source_id, provenance, origin_table, origin_id, dedupe_key)
    values (new.user_id, 'symptom', 'symptom', s, new.occurred_at, src, new.provenance, 'episodes', new.id, 'episodes:' || new.id || ':symptom:' || s);
  end loop;
  return new;
end $$;
create trigger episodes_observations after insert or update or delete on public.episodes
  for each row execute function public.episode_observations();

create function public.journal_observations() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.observations where origin_table = 'journal_entries' and origin_id = old.id;
  if tg_op = 'DELETE' then return old; end if;
  insert into public.observations (user_id, domain, metric, value_text, occurred_at, source_id, provenance, origin_table, origin_id, dedupe_key)
  values (new.user_id, 'context', 'note', new.text, new.occurred_at, public.you_source(new.user_id), new.provenance,
          'journal_entries', new.id, 'journal_entries:' || new.id);
  return new;
end $$;
create trigger journal_observations after insert or update or delete on public.journal_entries
  for each row execute function public.journal_observations();
