begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');
insert into public.profiles (id) values ('00000000-0000-0000-0000-00000000000a') on conflict (id) do nothing;
insert into public.provider_connections (id, user_id, endpoint_id, endpoint_name, fhir_base_url, vendor)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', 'e1', 'Riverside Health', 'https://fhir.example/R4', 'epic');

select lives_ok($$
  insert into public.clinical_records (user_id, connection_id, source_id, kind, name)
  select '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'x/' || k, k, 'Record'
  from unnest(array['report', 'note', 'encounter', 'appointment', 'device', 'family_history', 'goal', 'care_plan', 'coverage']) k
$$, 'reports, notes, visits, appointments, devices, family history, goals, care plans and coverage are kept');
select lives_ok($$
  insert into public.clinical_records (user_id, connection_id, source_id, kind, name)
  values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'Condition/1', 'condition', 'Endometriosis')
$$, 'the kinds already kept still are');
select throws_ok($$
  insert into public.clinical_records (user_id, connection_id, source_id, kind, name)
  values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'x/2', 'gossip', 'Record')
$$, '23514', null, 'a kind Ciatta does not read is refused');

select * from finish();
rollback;
