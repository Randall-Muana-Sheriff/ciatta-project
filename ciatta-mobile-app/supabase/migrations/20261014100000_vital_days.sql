-- Her blood pressure and blood oxygen, one row per metric per day of her
-- own calendar, for the metric detail screens. A cuff or watch posts many
-- readings a day; six months of them is too many to send to the phone to
-- average there, so they are averaged here.
--
-- Security invoker: observations' own owner select policy decides what is
-- read, so a caller only ever averages her own readings. Blood oxygen is
-- stored as HealthKit's fraction and returned as a percent. A day with no
-- reading has no row; it is a gap, never a zero.
create function public.vital_days(p_since date, p_tz text)
returns table (metric text, day date, avg_value numeric, min_value numeric, max_value numeric, n integer)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_tz is null or not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = p_tz) then
    raise exception 'not a time zone' using errcode = '22023';
  end if;
  return query
    select o.metric,
           (o.occurred_at at time zone p_tz)::date as day,
           round(avg(v.pct), 1),
           round(min(v.pct), 1),
           round(max(v.pct), 1),
           count(*)::integer
    from public.observations o
    cross join lateral (
      select case when o.metric = 'oxygen_saturation' and o.value <= 1 then o.value * 100 else o.value end as pct
    ) v
    where o.metric in ('blood_pressure_systolic', 'blood_pressure_diastolic', 'oxygen_saturation')
      and o.value is not null
      and (o.occurred_at at time zone p_tz)::date >= p_since
    group by o.metric, (o.occurred_at at time zone p_tz)::date
    order by 1, 2;
end $$;
revoke all on function public.vital_days(date, text) from public, anon;
grant execute on function public.vital_days(date, text) to authenticated;
