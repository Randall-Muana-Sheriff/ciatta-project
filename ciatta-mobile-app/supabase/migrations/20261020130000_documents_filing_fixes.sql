-- From the branch review of document filing:
--   · a medication the document stops is stopped today when the document
--     has no date of its own (it was left current)
--   · a stopped medication leaves her Health Details medications list
--   · filed allergies join her Allergies list, and every list takes each
--     name once, whatever its case
--   · a filed row can only name one of her own documents

-- A kept list with names added once each (case folded) and some removed.
create function public.names_merge(list jsonb, adding text[], removing text[]) returns jsonb
language sql immutable set search_path = '' as $$
  with kept as (
    select value #>> '{}' as name, ordinality as n
    from jsonb_array_elements(coalesce(list, '[]'::jsonb)) with ordinality
    where jsonb_typeof(value) = 'string'
      and lower(value #>> '{}') <> all (select lower(r) from unnest(coalesce(removing, '{}'::text[])) r)
  ),
  added as (
    select a as name, 1000000 + row_number() over () as n
    from unnest(coalesce(adding, '{}'::text[])) a
    where a is not null and trim(a) <> ''
      and lower(a) not in (select lower(name) from kept)
      and lower(a) <> all (select lower(r) from unnest(coalesce(removing, '{}'::text[])) r)
  ),
  every as (
    select distinct on (lower(name)) name, n from (select * from kept union all select * from added) u order by lower(name), n
  )
  select coalesce(jsonb_agg(to_jsonb(name) order by n), '[]'::jsonb) from every
$$;
revoke execute on function public.names_merge(jsonb, text[], text[]) from public, anon;
-- save_document runs as her and calls this; it reads nothing.
grant execute on function public.names_merge(jsonb, text[], text[]) to authenticated;

create or replace function public.save_document(
  p_doc_type text,
  p_title text,
  p_occurred_on date,
  p_storage_path text,
  p_metadata jsonb,
  p_filings jsonb,
  p_insurance jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  doc uuid;
  f jsonb := coalesce(p_filings, '{}'::jsonb);
  at timestamptz := coalesce(p_occurred_on, current_date)::text || 'T12:00:00Z';
  added_conditions text[];
  added_meds text[];
  added_allergies text[];
  stopped_meds text[];
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_storage_path is null or split_part(p_storage_path, '/', 1) <> me::text then
    raise exception 'not her file' using errcode = '42501';
  end if;
  if p_doc_type not in ('visit', 'imaging', 'pathology', 'prescription', 'referral', 'insurance', 'other') then
    raise exception 'not a document type' using errcode = '22023';
  end if;

  insert into public.documents (user_id, storage_path, title, doc_type, extraction_status, occurred_at, metadata)
  values (me, p_storage_path, p_title, p_doc_type, 'extracted', at,
          coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('linked', coalesce(f->'linked', '[]'::jsonb)))
  returning id into doc;

  insert into public.conditions (user_id, name, kind, status, provenance, occurred_on, document_id)
  select me, x->>'name', 'condition', coalesce(x->>'status', 'unknown'), 'DOCUMENT', p_occurred_on, doc
  from jsonb_array_elements(coalesce(f->'conditions', '[]'::jsonb)) x;

  insert into public.conditions (user_id, name, kind, status, provenance, occurred_on, note, document_id)
  select me, x->>'name', 'allergy', 'unknown', 'DOCUMENT', p_occurred_on, x->>'reaction', doc
  from jsonb_array_elements(coalesce(f->'allergies', '[]'::jsonb)) x;

  insert into public.medications (user_id, name, dose, started_on, stopped_on, provenance, metadata, document_id)
  select me, x->>'name', x->>'dose', (x->>'started_on')::date, (x->>'stopped_on')::date, 'DOCUMENT',
         jsonb_strip_nulls(jsonb_build_object('route', x->>'route', 'prescriber', x->>'prescriber')), doc
  from jsonb_array_elements(coalesce(f->'medications', '[]'::jsonb)) x;

  update public.medications set stopped_on = coalesce(p_occurred_on, current_date)
  where user_id = me and stopped_on is null
    and id in (select (x->>'id')::uuid from jsonb_array_elements(coalesce(f->'stop_medications', '[]'::jsonb)) x);

  insert into public.procedures (user_id, client_id, name, performed_on, provenance, document_id)
  select me, 'doc-' || gen_random_uuid(), x->>'name', coalesce((x->>'performed_on')::date, p_occurred_on, current_date), 'DOCUMENT', doc
  from jsonb_array_elements(coalesce(f->'procedures', '[]'::jsonb)) x;

  insert into public.referrals (user_id, client_id, specialty, clinician, reason, referred_by, referred_on, steps, document_id)
  select me, 'doc-' || gen_random_uuid(), x->>'specialty', x->>'clinician', x->>'reason', x->>'referred_by', (x->>'referred_on')::date,
         case when x->>'referred_on' is null then '{}'::jsonb else jsonb_build_object('referred', x->>'referred_on') end, doc
  from jsonb_array_elements(coalesce(f->'referrals', '[]'::jsonb)) x;

  if p_insurance is not null then
    update public.profiles set insurance = p_insurance where id = me;
  end if;

  -- Health Details shows her kept lists once she has edited them: what was
  -- filed joins them, each name once whatever its case, and a medication
  -- the document stopped leaves them. A list she has never kept is left
  -- alone; Health Details then reads the tables themselves.
  select array_agg(distinct x->>'name') into added_conditions from jsonb_array_elements(coalesce(f->'conditions', '[]'::jsonb)) x;
  select array_agg(distinct x->>'name') into added_meds from jsonb_array_elements(coalesce(f->'medications', '[]'::jsonb)) x where x->>'stopped_on' is null;
  select array_agg(distinct x->>'name') into added_allergies from jsonb_array_elements(coalesce(f->'allergies', '[]'::jsonb)) x;
  select array_agg(name) into stopped_meds from (
    select m.name from public.medications m
    where m.user_id = me and m.id in (select (x->>'id')::uuid from jsonb_array_elements(coalesce(f->'stop_medications', '[]'::jsonb)) x)
    union
    select x->>'name' from jsonb_array_elements(coalesce(f->'medications', '[]'::jsonb)) x where x->>'stopped_on' is not null
  ) s;

  update public.profiles p set onboarding = jsonb_set(p.onboarding, '{details}',
    (p.onboarding->'details')
      || case when jsonb_typeof(p.onboarding->'details'->'conditions') = 'array'
           then jsonb_build_object('conditions', public.names_merge(p.onboarding->'details'->'conditions', added_conditions, null)) else '{}'::jsonb end
      || case when jsonb_typeof(p.onboarding->'details'->'medications') = 'array'
           then jsonb_build_object('medications', public.names_merge(p.onboarding->'details'->'medications', added_meds, stopped_meds)) else '{}'::jsonb end
      || case when jsonb_typeof(p.onboarding->'details'->'allergies') = 'array'
           then jsonb_build_object('allergies', public.names_merge(p.onboarding->'details'->'allergies', added_allergies, null)) else '{}'::jsonb end)
  where p.id = me and jsonb_typeof(p.onboarding->'details') = 'object';

  return doc;
end $$;


-- A filed row names only a document of the same person. Foreign keys skip
-- RLS, so without this a row could point at someone else's document.
alter table public.documents add constraint documents_id_user unique (id, user_id);
alter table public.conditions add constraint conditions_document_user_fkey foreign key (document_id, user_id) references public.documents (id, user_id) on delete cascade;
alter table public.medications add constraint medications_document_user_fkey foreign key (document_id, user_id) references public.documents (id, user_id) on delete cascade;
alter table public.procedures add constraint procedures_document_user_fkey foreign key (document_id, user_id) references public.documents (id, user_id) on delete cascade;
alter table public.referrals add constraint referrals_document_user_fkey foreign key (document_id, user_id) references public.documents (id, user_id) on delete cascade;
