begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select has_type('public', 'consent_kind', 'the consent kind enum exists');
select has_table('public', 'consents', 'consents exists');

select has_column('public', 'consents', 'granted', 'consents records whether it was given');
select has_column('public', 'consents', 'policy_version', 'consents records which wording she agreed to');
select has_column('public', 'consents', 'occurred_at', 'consents records when');

-- Withdrawal is a new row, never an edit, so the history survives.
select hasnt_column('public', 'consents', 'withdrawn',
  'withdrawal is a later row with granted false, not a flag that erases the original');

-- She owns these rows and may add to them. She may not rewrite history.
select ok(has_table_privilege('authenticated', 'public.consents', 'SELECT'),
  'authenticated can read her own consents');
select ok(has_table_privilege('authenticated', 'public.consents', 'INSERT'),
  'authenticated can record a consent');
select ok(not has_table_privilege('authenticated', 'public.consents', 'UPDATE'),
  'authenticated cannot alter a consent already given');
select ok(not has_table_privilege('authenticated', 'public.consents', 'DELETE'),
  'authenticated cannot delete a consent record');
select ok(not has_table_privilege('anon', 'public.consents', 'SELECT'),
  'anon cannot read consents');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.consents'::regclass),
  'consents has row level security enabled');

select ok(
  exists (select 1 from pg_policies
          where schemaname = 'public' and tablename = 'consents' and cmd = 'SELECT'),
  'consents has an owner select policy');

select ok(
  (select count(*) from pg_indexes
    where schemaname = 'public' and tablename = 'consents'
      and indexname = 'consents_user_kind') = 1,
  'consents is indexed by user and kind, which is how a current state is read');

select * from finish();
rollback;
