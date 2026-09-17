-- Row level security on the vocabulary, as a second barrier behind the grants.
--
-- This table was deliberately shipped without RLS in 20260918100000, and the
-- reasoning there was sound: concepts is reference data, a LOINC code for
-- heart rate is the same fact for every person alive, and there is no owner
-- to scope a policy to. Access was defended by grants instead, which was
-- verified live: anon holds nothing at all, authenticated holds select only,
-- and neither can insert, update or delete.
--
-- What the database linter pointed out, correctly, is that the defence is
-- grants ALONE. The table is exposed to PostgREST, so a future migration that
-- widened a grant, or a `grant all on all tables in schema public` written in
-- haste, would meet no second barrier and would hand write access to a signed
-- in user. Every other table in this schema has RLS as that second barrier.
-- This one had a reason not to, and the reason was about policies rather than
-- about protection.
--
-- So RLS goes on, with a policy that permits exactly what the grants already
-- permit and nothing more. Nothing changes functionally today: she can read
-- the vocabulary and that is all she could do before. What changes is that
-- reading is now permitted by an explicit policy rather than by the absence of
-- one, and any future write grant would still be refused by default because no
-- policy allows a write.
--
-- using (true) is honest here in a way it would not be on any other table.
-- Elsewhere in this schema `true` would mean one woman could read another
-- woman's health information. Here every row is reference data with no owner,
-- so there is no per user predicate that would mean anything. The predicate is
-- unconditional because the data genuinely is.
--
-- service_role is unaffected: it bypasses RLS, which is what lets the seeder
-- write these rows.
alter table public.concepts enable row level security;

-- select only, and to authenticated only. anon is named nowhere, so it holds
-- nothing here by policy as well as by grant.
create policy concepts_read on public.concepts
  for select to authenticated
  using (true);

comment on policy concepts_read on public.concepts is 'Reference data, readable by any signed in user. using (true) is unconditional because the rows have no owner: a LOINC code is the same fact for everyone. No policy permits insert, update or delete, so writes are refused by default even if a grant were widened later.';
