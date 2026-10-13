-- At most 40 food scans per person per day. Each scan is a paid call to a
-- vision model; the limit keeps a stuck loop or a misuse from running up
-- a bill. Counted here, under the caller's own id, and refused past the
-- limit before the model is called. The phone can read nothing and write
-- nothing in this table; only claim_food_scan touches it.
create table public.food_scan_uses (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);
alter table public.food_scan_uses enable row level security;
revoke all on public.food_scan_uses from anon, authenticated;
grant all on public.food_scan_uses to service_role;

create function public.claim_food_scan() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  used integer;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.food_scan_uses (user_id, day, count) values (me, current_date, 1)
  on conflict (user_id, day) do update set count = public.food_scan_uses.count + 1
  returning count into used;
  return used <= 40;
end $$;
revoke execute on function public.claim_food_scan() from public, anon;
grant execute on function public.claim_food_scan() to authenticated;
