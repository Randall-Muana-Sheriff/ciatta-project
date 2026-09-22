-- How the app reads and writes the loop. Nine functions, each with its own
-- revoke and grant. Most run as her (security invoker) so row level
-- security is the only boundary; the three that touch rows the client may
-- never write (threads, recommendations) run as definer, check that the row
-- is hers before anything else, and change exactly the columns named here.
--
-- get_today is the one read Today needs: the newest live insight with what
-- has changed about it since she last looked, what she is offered, what she
-- is trying, and what was learned since her last visit. The "since" value
-- is computed here from insight_views every time and never stored, so it
-- cannot go stale.

-- Moves her last visit stamp and hands back the one before it, so the
-- caller can read "since last visit" once and then advance it.
create function public.record_visit() returns timestamptz
language plpgsql security invoker set search_path = '' as $$
declare
  previous timestamptz;
begin
  select last_visit_at into previous from public.profiles where id = (select auth.uid()) for update;
  update public.profiles set last_visit_at = now() where id = (select auth.uid());
  return previous;
end $$;
revoke execute on function public.record_visit() from public, anon, authenticated;
grant execute on function public.record_visit() to authenticated;

-- She has seen this insight, now. An insight that is not hers is not
-- found (P0002), because the read runs under her row level security.
create function public.record_insight_view(p_insight_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  seen_status text;
begin
  select status into seen_status from public.insights where id = p_insight_id;
  if seen_status is null then
    raise exception 'insight not found' using errcode = 'P0002';
  end if;
  insert into public.insight_views (user_id, insight_id, status_when_last_seen)
  values ((select auth.uid()), p_insight_id, seen_status)
  on conflict (user_id, insight_id) do update
    set last_seen_at = now(),
        viewed_count = public.insight_views.viewed_count + 1,
        status_when_last_seen = excluded.status_when_last_seen;
end $$;
revoke execute on function public.record_insight_view(uuid) from public, anon, authenticated;
grant execute on function public.record_insight_view(uuid) to authenticated;

-- Watching is a thread status, and threads are the server's, so this runs
-- as definer and checks ownership first. Turning watching off restores
-- what the function would have written from the count: recurring when it
-- has been seen twice, new otherwise. Her stance is recorded beside it.
create function public.set_thread_watch(p_thread_id uuid, p_watching boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  seen integer;
begin
  select observation_count into seen from public.threads where id = p_thread_id and user_id = uid;
  if seen is null then
    raise exception 'thread not found' using errcode = 'P0002';
  end if;
  if p_watching then
    update public.threads set status = 'watching' where id = p_thread_id;
    if not exists (select 1 from public.considerations
                   where user_id = uid and basis_kind = 'thread' and basis_id = p_thread_id and status = 'active') then
      insert into public.considerations (user_id, basis_kind, basis_id, status)
      values (uid, 'thread', p_thread_id, 'active');
    end if;
  else
    update public.threads
    set status = case when seen >= 2 then 'recurring'::public.thread_status else 'new'::public.thread_status end
    where id = p_thread_id;
    update public.considerations set status = 'dismissed', reason = 'other'
    where user_id = uid and basis_kind = 'thread' and basis_id = p_thread_id and status = 'active';
  end if;
end $$;
revoke execute on function public.set_thread_watch(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_thread_watch(uuid, boolean) to authenticated;

-- An offer she took up, or turned down with a reason. Both run as definer
-- because recommendations are the server's; both check the row is hers.
create function public.accept_recommendation(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if not exists (select 1 from public.recommendations where id = p_id and user_id = uid) then
    raise exception 'recommendation not found' using errcode = 'P0002';
  end if;
  update public.recommendations set status = 'accepted' where id = p_id;
  insert into public.considerations (user_id, basis_kind, basis_id, status)
  values (uid, 'recommendation', p_id, 'active');
end $$;
revoke execute on function public.accept_recommendation(uuid) from public, anon, authenticated;
grant execute on function public.accept_recommendation(uuid) to authenticated;

create function public.dismiss_recommendation(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if p_reason is null or p_reason not in ('not_relevant', 'already_handled', 'dont_want_to', 'waiting', 'other') then
    raise exception 'reason must be one of the listed reasons' using errcode = '22023';
  end if;
  if not exists (select 1 from public.recommendations where id = p_id and user_id = uid) then
    raise exception 'recommendation not found' using errcode = 'P0002';
  end if;
  update public.recommendations
  set status = 'dismissed', dismissed_at = now(), dismissal_reason = p_reason
  where id = p_id;
  insert into public.considerations (user_id, basis_kind, basis_id, status, reason)
  values (uid, 'recommendation', p_id, 'dismissed', p_reason);
end $$;
revoke execute on function public.dismiss_recommendation(uuid, text) from public, anon, authenticated;
grant execute on function public.dismiss_recommendation(uuid, text) to authenticated;

-- Something she decided to try. One of a kind per day: asking twice hands
-- back the same action. Three days is the window the outcome is measured
-- over, the same three the app already shows for a planned walk.
create function public.start_action(
  p_kind text,
  p_title text,
  p_intent text default null,
  p_metric text default null,
  p_wanted text default null,
  p_insight_id uuid default null,
  p_recommendation_id uuid default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  action_id uuid;
begin
  insert into public.actions (user_id, kind, title, intent, metric, wanted, target_end_at, created_from_insight_id, created_from_recommendation_id)
  values ((select auth.uid()), p_kind, p_title, p_intent, p_metric, p_wanted, now() + interval '3 days', p_insight_id, p_recommendation_id)
  on conflict (user_id, kind, started_on) do update set updated_at = now()
  returning id into action_id;
  if p_recommendation_id is not null then
    perform public.accept_recommendation(p_recommendation_id);
  end if;
  return action_id;
end $$;
revoke execute on function public.start_action(text, text, text, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_action(text, text, text, text, text, uuid, uuid) to authenticated;

create function public.end_action(p_action_id uuid, p_status text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if p_status not in ('ended', 'abandoned') then
    raise exception 'status must be ended or abandoned' using errcode = '22023';
  end if;
  update public.actions set status = p_status, ended_at = now()
  where id = p_action_id and user_id = (select auth.uid());
  if not found then
    raise exception 'action not found' using errcode = 'P0002';
  end if;
end $$;
revoke execute on function public.end_action(uuid, text) from public, anon, authenticated;
grant execute on function public.end_action(uuid, text) to authenticated;

-- What she says happened. Writes the reported half only; the measured half
-- belongs to the server and the column grants keep it that way even here.
create function public.report_outcome(p_action_id uuid, p_reported text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.actions where id = p_action_id and user_id = (select auth.uid())) then
    raise exception 'action not found' using errcode = 'P0002';
  end if;
  insert into public.outcomes (user_id, action_id, reported, reported_at)
  values ((select auth.uid()), p_action_id, p_reported, now())
  on conflict (user_id, action_id) do update
    set reported = excluded.reported, reported_at = now();
end $$;
revoke execute on function public.report_outcome(uuid, text) from public, anon, authenticated;
grant execute on function public.report_outcome(uuid, text) to authenticated;

-- Today, in one read, under her row level security. since is one of new,
-- updated, continuing, resolved, unchanged: what has happened to the
-- newest live insight relative to when she last looked at it. A replaced
-- insight is a new row she has not seen, so it reads updated rather than
-- new when its status says so.
create function public.get_today() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  visit timestamptz;
  ins record;
  seen record;
  since text;
begin
  select last_visit_at into visit from public.profiles where id = uid;

  select i.id, i.title, i.status, i.updated_at, i.valid_from, i.thread_id,
         t.key as thread_key, t.status as thread_status, t.observation_count
  into ins
  from public.insights i join public.threads t on t.id = i.thread_id
  where i.user_id = uid and i.valid_to is null and i.status <> 'dismissed'
  order by i.valid_from desc
  limit 1;

  if ins.id is not null then
    select * into seen from public.insight_views where user_id = uid and insight_id = ins.id;
    since := case
      when seen.id is null then (case when ins.status = 'updated' then 'updated' else 'new' end)
      when ins.status = 'resolved' then 'resolved'
      when ins.status = 'updated' and ins.updated_at > seen.last_seen_at then 'updated'
      when ins.status = 'continuing' and ins.updated_at > seen.last_seen_at then 'continuing'
      else 'unchanged'
    end;
  end if;

  return jsonb_build_object(
    'last_visit_at', visit,
    'insight', case when ins.id is null then null else jsonb_build_object(
      'id', ins.id, 'title', ins.title, 'status', ins.status, 'since', since,
      'thread_id', ins.thread_id, 'thread_key', ins.thread_key, 'thread_status', ins.thread_status,
      'observation_count', ins.observation_count, 'updated_at', ins.updated_at
    ) end,
    'recommendations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'type', r.type, 'title', r.title, 'body', r.body, 'status', r.status,
        'insight_id', r.insight_id, 'thread_id', r.thread_id, 'change_id', r.change_id
      ) order by r.type, r.created_at)
      from public.recommendations r
      where r.user_id = uid and r.status in ('active', 'accepted')
    ), '[]'::jsonb),
    'actions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'kind', a.kind, 'title', a.title, 'intent', a.intent, 'metric', a.metric, 'wanted', a.wanted,
        'started_on', a.started_on, 'status', a.status,
        'outcome', case when o.id is null then null else jsonb_build_object(
          'reported', o.reported, 'measured', o.measured, 'measured_evidence', o.measured_evidence
        ) end
      ) order by a.started_on desc, a.created_at desc)
      from public.actions a left join public.outcomes o on o.action_id = a.id
      where a.user_id = uid and a.started_on >= current_date - 14
    ), '[]'::jsonb),
    'learning', coalesce((
      select jsonb_agg(x.e order by x.occurred_at desc)
      from (
        select jsonb_build_object('id', l.id, 'type', l.type, 'summary', l.summary, 'occurred_at', l.occurred_at) as e, l.occurred_at
        from public.learning_events l
        where l.user_id = uid and (visit is null or l.occurred_at > visit)
        order by l.occurred_at desc
        limit 5
      ) x
    ), '[]'::jsonb)
  );
end $$;
revoke execute on function public.get_today() from public, anon, authenticated;
grant execute on function public.get_today() to authenticated;
