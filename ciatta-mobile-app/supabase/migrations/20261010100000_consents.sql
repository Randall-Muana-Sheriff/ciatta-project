-- What she agreed to, when, and to which wording.
--
-- A table rather than columns on profiles, because consent has a history and
-- a profile field has only a present. "Did she consent to marketing on the
-- day she signed up, and has she since withdrawn it" is a question a boolean
-- cannot answer, and it is the question that gets asked when someone
-- complains or an auditor arrives.
--
-- Append only by design: there is no update or delete grant below. A
-- withdrawal is a new row with granted false, so the original consent and
-- the moment it ended both survive. Letting her edit the old row would let
-- the record say she never agreed to something she did.
create type public.consent_kind as enum ('terms', 'privacy', 'marketing_email');

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.consent_kind not null,
  -- False is a real value here, not an absence. Declining marketing is
  -- something she did, and the record has to be able to show she was asked
  -- and said no, which is different from never having been asked.
  granted boolean not null,
  -- Which wording she saw. Terms change; a consent to the February text is
  -- not a consent to the August one, and without this the record cannot say
  -- which she agreed to.
  policy_version text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index consents_user_kind on public.consents (user_id, kind, occurred_at desc);

alter table public.consents enable row level security;
create policy "owner select" on public.consents for select to authenticated
  using (user_id = (select auth.uid()));
create policy "owner insert" on public.consents for insert to authenticated
  with check (user_id = (select auth.uid()));

revoke all on public.consents from anon, authenticated;
grant select, insert on public.consents to authenticated;
grant all on public.consents to service_role;

comment on table public.consents is 'Append only. A withdrawal is a new row with granted false, never an edit, so the original consent and the moment it ended both survive.';
comment on column public.consents.granted is 'False is a real value: it records that she was asked and declined, which is different from never having been asked.';
