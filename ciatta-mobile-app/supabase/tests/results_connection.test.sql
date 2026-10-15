begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'c@test.local');
insert into public.provider_connections (id, user_id, endpoint_id, endpoint_name, fhir_base_url, vendor, status) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'https://one.example/R4', 'Hospital One', 'https://one.example/R4', 'epic', 'active');

select has_column('public', 'results', 'connection_id', 'a provider lab names the connection it came from');

select lives_ok($$
  insert into public.results (user_id, test_name, value, occurred_at, source, source_ref, connection_id)
  values ('00000000-0000-0000-0000-0000000000c1', 'TSH', 4.2, '2026-01-01', 'provider',
          '20000000-0000-0000-0000-000000000001:Observation/1', '20000000-0000-0000-0000-000000000001')
$$, 'a lab is written against a connection she has');

delete from public.provider_connections where id = '20000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.results where user_id = '00000000-0000-0000-0000-0000000000c1'), 0,
  'removing the connection takes its labs with it, in the same statement');

-- A sync that was still running when she removed the provider.
select throws_ok($$
  insert into public.results (user_id, test_name, value, occurred_at, source, source_ref, connection_id)
  values ('00000000-0000-0000-0000-0000000000c1', 'TSH', 3.9, '2026-02-01', 'provider',
          '20000000-0000-0000-0000-000000000001:Observation/2', '20000000-0000-0000-0000-000000000001')
$$, '23503', null, 'a lab from a removed connection cannot be written back');

select is((select count(*)::int from public.results where user_id = '00000000-0000-0000-0000-0000000000c1'), 0,
  'and nothing from it is left in her labs');

select * from finish();
rollback;
