begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select col_default_is('public', 'profiles', 'notify_checkins', 'true', 'check ins are on unless she turns them off');
select has_column('public', 'profiles', 'last_checkin_push', 'the day the last check in push went is kept');
select ok(has_column_privilege('authenticated', 'public.profiles', 'notify_checkins', 'UPDATE'), 'she can turn check ins off');
select ok(not has_table_privilege('authenticated', 'public.log_read_uses', 'SELECT'), 'the app cannot read the log read counter');
select ok(has_function_privilege('authenticated', 'public.claim_log_read()', 'EXECUTE'), 'a signed in person can claim a read');
select ok(not has_function_privilege('anon', 'public.claim_log_read()', 'EXECUTE'), 'anon cannot claim a read');

select * from finish();
rollback;
