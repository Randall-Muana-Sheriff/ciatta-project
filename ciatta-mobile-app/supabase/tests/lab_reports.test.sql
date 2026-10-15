begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'e@test.local'),
  ('00000000-0000-0000-0000-0000000000f1', 'f@test.local');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';

create temp table saved (id uuid) on commit drop;
grant all on saved to authenticated;

select lives_ok($$
  insert into saved select public.save_lab_report(
    'Quest Diagnostics', '2026-06-12',
    '00000000-0000-0000-0000-0000000000e1/lab-reports/r1.pdf',
    '{"lab":"Quest Diagnostics","pages":3,"checksum":"abc"}'::jsonb,
    '[{"name":"Hemoglobin","panel":"Complete Blood Count","value":11.2,"value_text":null,"unit":"g/dL","low":12,"high":15.5,"range":"12.0 to 15.5","flag":"L"},
      {"name":"HBsAg","panel":null,"value":null,"value_text":"Non reactive","unit":null,"low":null,"high":null,"range":"Non reactive","flag":null}]'::jsonb)
$$, 'she can save a report');

select is((select count(*)::int from public.documents where doc_type = 'lab_report'), 1, 'one report');
select is((select count(*)::int from public.results where document_id = (select id from saved)), 2, 'its results point at it');
select is((select panel from public.results where test_name = 'Hemoglobin'), 'Complete Blood Count', 'the panel is kept');
select is((select source from public.results where test_name = 'HBsAg'), 'report', 'results are marked as read from a report');
select is((select id from public.documents where metadata->>'checksum' = 'abc' and doc_type = 'lab_report'), (select id from saved),
  'the same file is found again by its checksum');

select throws_ok($$
  select public.save_lab_report('X', '2026-06-12', '00000000-0000-0000-0000-0000000000e1/lab-reports/r2.pdf', '{}'::jsonb,
    '[{"name":"TSH","panel":null,"value":2,"value_text":null,"unit":null,"low":null,"high":null,"range":null,"flag":null},
      {"name":"Bad","panel":null,"value":1,"value_text":null,"unit":null,"low":null,"high":null,"range":null,"flag":"Q"}]'::jsonb)
$$, '23514', null, 'one invalid line refuses the whole report');
select is((select count(*)::int from public.documents where storage_path like '%r2.pdf'), 0, 'and nothing of it was saved');

select throws_ok($$
  select public.save_lab_report('X', '2026-06-12', '00000000-0000-0000-0000-0000000000f1/lab-reports/r3.pdf', '{}'::jsonb,
    '[{"name":"TSH","panel":null,"value":2,"value_text":null,"unit":null,"low":null,"high":null,"range":null,"flag":null}]'::jsonb)
$$, '42501', null, 'a file outside her own folder is refused');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select is(public.remove_lab_report((select id from saved)), null, 'someone else cannot remove her report');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';
select is(public.remove_lab_report((select id from saved)), '00000000-0000-0000-0000-0000000000e1/lab-reports/r1.pdf',
  'she removes it, and is given the file to delete');

select * from finish();
rollback;
