begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select has_column('public', 'provider_connections', 'source', 'a connection says whether it is SMART or Fasten');
select col_default_is('public', 'provider_connections', 'source', 'smart'::text, 'existing connections are SMART');

-- The Fasten ids are kept from her client, as the tokens are.
select ok(has_column_privilege('authenticated', 'public.provider_connections', 'source', 'SELECT'), 'the app can read which kind a connection is');
select ok(not has_column_privilege('authenticated', 'public.provider_connections', 'fasten_org_connection_id', 'SELECT'), 'the app cannot read the Fasten connection id');
select ok(not has_column_privilege('authenticated', 'public.provider_connections', 'fasten_export_task_id', 'SELECT'), 'the app cannot read the Fasten export task');

select ok(not has_table_privilege('authenticated', 'public.fasten_connect_requests', 'SELECT'), 'the app cannot read connect requests');
select ok(not has_table_privilege('anon', 'public.fasten_connect_requests', 'SELECT'), 'anon cannot read connect requests');
select ok(not has_table_privilege('authenticated', 'public.fasten_webhook_events', 'SELECT'), 'the app cannot read webhook events');

-- A SMART connection still needs its server; a Fasten one does not.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000fa571', 'fasten-sql@example.com');

select throws_ok(
  $$ insert into public.provider_connections (user_id, endpoint_id, endpoint_name, vendor, source)
     values ('00000000-0000-0000-0000-0000000fa571', 'https://x', 'X', 'epic', 'smart') $$,
  '23514', null, 'a SMART connection without a server address is refused'
);

select lives_ok(
  $$ insert into public.provider_connections (user_id, endpoint_id, endpoint_name, vendor, source, fasten_org_connection_id)
     values ('00000000-0000-0000-0000-0000000fa571', 'fasten:e1', 'Foo Clinic', 'fasten', 'fasten', 'org-1') $$,
  'a Fasten connection needs no server address'
);

select throws_ok(
  $$ insert into public.provider_connections (user_id, endpoint_id, endpoint_name, vendor, source, fasten_org_connection_id)
     values ('00000000-0000-0000-0000-0000000fa571', 'fasten:e2', 'Other', 'fasten', 'fasten', 'org-1') $$,
  '23505', null, 'one Fasten connection id belongs to one connection'
);

select throws_ok(
  $$ insert into public.provider_connections (user_id, endpoint_id, endpoint_name, vendor, source)
     values ('00000000-0000-0000-0000-0000000fa571', 'y', 'Y', 'epic', 'neither') $$,
  '23514', null, 'source is smart or fasten'
);

select * from finish();
rollback;
