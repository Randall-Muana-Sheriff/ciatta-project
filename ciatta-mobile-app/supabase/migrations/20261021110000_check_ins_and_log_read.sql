-- Check ins and conversational logging.
--
-- notify_checkins is her switch for the once a day "Ciatta has a quick
-- question for you." push (Profile, Notifications, Check ins), on unless
-- she turns it off, as New Findings is. last_checkin_push is the day the
-- intelligence run last sent one, so it sends at most one a day. She can
-- read and change both, as with every other column of her profile; the
-- worst she can do with the second is quiet her own push.

alter table public.profiles
  add column notify_checkins boolean not null default true,
  add column last_checkin_push date;

-- Reading what she says to Ciatta, counted per day so a stuck client
-- cannot run up model calls. Generous: this is how she logs now.
create table public.log_read_uses (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);
alter table public.log_read_uses enable row level security;
revoke all on public.log_read_uses from anon, authenticated;
grant all on public.log_read_uses to service_role;

create function public.claim_log_read() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  used integer;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.log_read_uses (user_id, day, count) values (me, current_date, 1)
  on conflict (user_id, day) do update set count = public.log_read_uses.count + 1
  returning count into used;
  return used <= 200;
end $$;
revoke execute on function public.claim_log_read() from public, anon;
grant execute on function public.claim_log_read() to authenticated;
