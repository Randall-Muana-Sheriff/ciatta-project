-- Every account created before 20260915100000 predates handle_new_user, and
-- that trigger only fires on insert into auth.users. Signing in with a new
-- provider links an identity to the existing account rather than creating
-- one, so those accounts reach the app with no profile row and no "You"
-- source: her name never appears, her sources list is empty, and worse,
-- saving her cycle profile updates a row that does not exist and silently
-- saves nothing.
--
-- Both inserts mirror handle_new_user exactly and are idempotent, so this is
-- safe to re-run and safe on a project that has no such accounts.

insert into public.profiles (id, first_name)
select u.id,
       nullif(split_part(coalesce(u.raw_user_meta_data ->> 'full_name',
                                  u.raw_user_meta_data ->> 'name', ''), ' ', 1), '')
from auth.users u
on conflict (id) do nothing;

insert into public.health_sources (user_id, kind, name, status)
select u.id, 'user_report', 'You', 'active'
from auth.users u
on conflict (user_id, kind, name) do nothing;
