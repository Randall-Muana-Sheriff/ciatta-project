begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select cmp_ok((select count(*)::int from public.research_insights), '>=', 9, 'every signed in person reads the research library');
select is((select count(*)::int from public.research_insights where jsonb_array_length(sources) < 1), 0, 'every insight names its sources');
select throws_ok($$
  insert into public.research_insights (id, sort, title, image, highlights, body, sources) values ('x', 99, 'x', 'cycle', '["a"]', 'b', '[{"title":"t"}]')
$$, '42501', null, 'no one but the service writes to it');
select throws_ok($$ update public.research_insights set title = 'changed' where id = 'iron-fatigue' $$, '42501', null, 'nor changes it');

reset role;
select throws_ok($$
  insert into public.research_insights (id, sort, title, image, highlights, body, sources) values ('y', 99, 'y', 'unknown', '["a"]', 'b', '[{"title":"t"}]')
$$, '23514', null, 'only the known heading images');

select * from finish();
rollback;
