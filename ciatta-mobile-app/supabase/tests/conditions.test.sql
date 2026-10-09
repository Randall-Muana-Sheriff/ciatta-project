begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select has_table('public', 'conditions', 'conditions exists');
select has_type('public', 'condition_kind', 'the condition kind enum exists');

-- Three kinds: a diagnosis, an operation, and something she reports feeling.
select ok(
  'symptom' = any (enum_range(null::public.condition_kind)::text[]),
  'condition_kind includes symptom, so a reported symptom has somewhere to live');
select ok(
  'condition' = any (enum_range(null::public.condition_kind)::text[]),
  'condition_kind still includes condition');
select ok(
  'surgery' = any (enum_range(null::public.condition_kind)::text[]),
  'condition_kind still includes surgery');

-- Her own report, and she can correct it.
select ok(has_table_privilege('authenticated', 'public.conditions', 'SELECT'),
  'authenticated can read her conditions');
select ok(has_table_privilege('authenticated', 'public.conditions', 'INSERT'),
  'authenticated can add a condition');
select ok(has_table_privilege('authenticated', 'public.conditions', 'DELETE'),
  'authenticated can remove one she added by mistake');
select ok(not has_table_privilege('anon', 'public.conditions', 'SELECT'),
  'anon cannot read conditions');

-- Defaulting to active would assert a clinical fact she did not give.
select col_default_is('public', 'conditions', 'status', 'unknown',
  'status defaults to unknown, because listing something does not establish it is current');

select * from finish();
rollback;
