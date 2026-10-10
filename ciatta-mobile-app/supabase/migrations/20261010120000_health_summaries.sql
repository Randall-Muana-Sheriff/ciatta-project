-- Her health profile in prose, as last written.
--
-- Cached rather than regenerated on every open: the paragraph costs a model
-- call, and a woman opening Today four times in an evening should not pay
-- for four of them. One row per woman, replaced each time it is rebuilt,
-- because this is the current summary and not a history of summaries.
--
-- Every sentence stored here passed checkSummary in the edge function,
-- which holds a model's answer to the same rules wording.ts holds a written
-- sentence to: no diagnosis, no cause, no number that is not in her record,
-- and no condition or medication she did not name. Nothing writes here
-- without passing that gate.
create table public.health_summaries (
  user_id uuid primary key references auth.users (id) on delete cascade,
  summary text not null,
  -- Which model wrote it, so a summary written by an older one can be found
  -- and rebuilt rather than trusted indefinitely.
  model text not null,
  -- How much of her record existed when it was written. A summary built on
  -- nine observations is not the same claim as one built on nine thousand,
  -- and the screen may want to say so.
  facts_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- She reads and writes only her own, like every other table in her record.
-- The function runs as her, so these are the policies it is held to as
-- well: it has no service role path to anybody else's row.
select public.enable_owner_rls('health_summaries');

revoke all on public.health_summaries from anon, authenticated;
grant select, insert, update, delete on public.health_summaries to authenticated;
grant all on public.health_summaries to service_role;

comment on table public.health_summaries is 'Her health profile in prose, one row per woman, replaced on each rebuild. Every sentence here passed the same checks a written sentence passes: no diagnosis, no cause, no ungrounded number, no condition or medication she did not name.';
comment on column public.health_summaries.facts_count is 'Observations in her record when this was written. A summary built on nine observations is a different claim from one built on nine thousand.';
