begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f6', 'f6@test.local');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f6","role":"authenticated"}';
select is(
  public.save_document('other', 'A note', '2026-09-02', '00000000-0000-0000-0000-0000000000f6/documents/80000000-0000-0000-0000-000000000001.pdf',
    '{}'::jsonb, '{}'::jsonb, null, '80000000-0000-0000-0000-000000000001'),
  '80000000-0000-0000-0000-000000000001'::uuid, 'the document takes the id its stored file is named for');

select public.claim_lab_scan() from generate_series(1, 3);
select throws_ok($$ select public.refund_lab_scan('00000000-0000-0000-0000-0000000000f6', 2) $$, '42501', null, 'she cannot refund her own reads');

reset role;
set local role service_role;
select lives_ok($$ select public.refund_lab_scan('00000000-0000-0000-0000-0000000000f6', 2) $$, 'the server refunds reads it handed on');
reset role;
select is((select count from public.lab_scan_uses where user_id = '00000000-0000-0000-0000-0000000000f6'), 1, 'two of three reads were refunded');
set local role service_role;
select public.refund_lab_scan('00000000-0000-0000-0000-0000000000f6', 9);
reset role;
select is((select count from public.lab_scan_uses where user_id = '00000000-0000-0000-0000-0000000000f6'), 0, 'never below zero');

select * from finish();
rollback;
