-- Refuse what is not a day or not a list, rather than storing it.
-- Same function as 20261013160000 with two checks added after sign in.
create or replace function public.save_daily_log(
  p_day date,
  p_digestion text[] default null,
  p_foods text[] default null,
  p_caffeine numeric default null,
  p_alcohol numeric default null,
  p_energy smallint default null,
  p_mood smallint default null,
  p_stress smallint default null,
  p_note text default null,
  p_attachments jsonb default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  -- Today or tomorrow at most (her time zone may be ahead of the server's),
  -- and nothing before 1900: anything else is a mistake, not a day.
  if p_day > current_date + 1 or p_day < date '1900-01-01' then
    raise exception 'not a day she can log' using errcode = '22023';
  end if;
  if p_attachments is not null and jsonb_typeof(p_attachments) <> 'array' then
    raise exception 'files must be a list' using errcode = '22023';
  end if;

  insert into public.daily_metrics (user_id, day, provenance)
  values (me, p_day, 'REPORTED')
  on conflict (user_id, day) do nothing;

  update public.daily_metrics d set
    digestion = case when p_digestion is null then d.digestion
                     else array(
                       select f from unnest(coalesce(d.digestion, '{}') || p_digestion) with ordinality as t(f, n)
                       group by f order by min(n)
                     ) end,
    foods = case when p_foods is null then d.foods else coalesce(d.foods, '{}') || p_foods end,
    caffeine = coalesce(p_caffeine, d.caffeine),
    alcohol = coalesce(p_alcohol, d.alcohol),
    energy = coalesce(p_energy, d.energy),
    mood = coalesce(p_mood, d.mood),
    stress = coalesce(p_stress, d.stress),
    note = case when p_note is null then d.note
                when d.note is null or d.note = '' then p_note
                else d.note || E'\n' || p_note end,
    metadata = case when p_attachments is null then d.metadata
                    else jsonb_set(d.metadata, '{attachments}', coalesce(d.metadata -> 'attachments', '[]'::jsonb) || p_attachments) end,
    updated_at = now()
  where d.user_id = me and d.day = p_day;
end $$;
