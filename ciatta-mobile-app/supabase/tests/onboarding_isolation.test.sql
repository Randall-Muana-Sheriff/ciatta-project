begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- The owner policies on the two onboarding tables, tested against a second
-- user rather than asserted. Review found that the shape tests proved a
-- policy existed and never proved its predicate did anything, which is the
-- difference between a policy and a policy that works.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@test.local');

-- Seeded as the table owner, which bypasses RLS, so the reads below are real
-- cross owner reads rather than reads of an empty table.
insert into public.conditions (user_id, kind, name) values
  ('00000000-0000-0000-0000-0000000000c2', 'condition', 'Endometriosis'),
  ('00000000-0000-0000-0000-0000000000c2', 'symptom', 'Fatigue');
insert into public.consents (user_id, kind, granted, policy_version) values
  ('00000000-0000-0000-0000-0000000000c2', 'terms', true, '2026-10-09'),
  ('00000000-0000-0000-0000-0000000000c2', 'marketing_email', false, '2026-10-09');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';

-- C1 cannot see anything of C2's.
select is_empty($$ select 1 from public.conditions $$,
  'one woman cannot read another woman''s conditions or symptoms');
select is_empty($$ select 1 from public.consents $$,
  'one woman cannot read another woman''s consent record');

-- Nor write rows that claim to be hers.
select throws_ok($$
  insert into public.conditions (user_id, kind, name)
  values ('00000000-0000-0000-0000-0000000000c2', 'condition', 'forged')
$$, '42501', null, 'C1 cannot insert a condition claiming to be C2''s');
select throws_ok($$
  insert into public.consents (user_id, kind, granted, policy_version)
  values ('00000000-0000-0000-0000-0000000000c2', 'terms', true, 'forged')
$$, '42501', null, 'C1 cannot forge a consent in C2''s name');

-- Her own rows work, which is what makes the refusals above meaningful
-- rather than a table nobody can write at all.
select lives_ok($$
  insert into public.conditions (user_id, kind, name)
  values ('00000000-0000-0000-0000-0000000000c1', 'symptom', 'Bloating')
$$, 'she can record her own symptom');
select lives_ok($$
  insert into public.consents (user_id, kind, granted, policy_version)
  values ('00000000-0000-0000-0000-0000000000c1', 'terms', true, '2026-10-09')
$$, 'she can record her own consent');

-- Append only, enforced rather than described. Both of these are the whole
-- reason the table exists: a consent she cannot alter is a consent that can
-- still be shown to have happened.
select throws_ok($$
  update public.consents set granted = false where user_id = '00000000-0000-0000-0000-0000000000c1'
$$, '42501', null, 'she cannot rewrite a consent she already gave');
select throws_ok($$
  delete from public.consents where user_id = '00000000-0000-0000-0000-0000000000c1'
$$, '42501', null, 'she cannot delete a consent record');

select * from finish();
rollback;
