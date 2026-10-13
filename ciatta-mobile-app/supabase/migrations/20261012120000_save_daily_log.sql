-- She logs her day, and it is kept.
--
-- daily_metrics is read only to the client (20260916100100): device sync
-- owns the measured columns and must never be overwritten from the phone.
-- That file promised the self reported columns would come back through an
-- explicit path rather than by reopening the table. This is that path: one
-- function that writes only her columns, only her row, and only what she
-- sent. Null means "not sent", so it leaves the column as it was.
-- Lists merge rather than replace, so a quick "bloated" does not erase
-- this morning's foods. A note is appended. Files are appended to
-- metadata.attachments.
create function public.save_daily_log(
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

  insert into public.daily_metrics (user_id, day, provenance)
  values (me, p_day, 'REPORTED')
  on conflict (user_id, day) do nothing;

  update public.daily_metrics d set
    digestion = case when p_digestion is null then d.digestion
                     else array(select distinct unnest(coalesce(d.digestion, '{}') || p_digestion)) end,
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

revoke execute on function public.save_daily_log(date, text[], text[], numeric, numeric, smallint, smallint, smallint, text, jsonb) from public, anon;
grant execute on function public.save_daily_log(date, text[], text[], numeric, numeric, smallint, smallint, smallint, text, jsonb) to authenticated;
