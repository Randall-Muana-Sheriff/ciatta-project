-- Any medical document she adds, and what it files: conditions, allergies,
-- medications, procedures, referrals and her plan, all written with the
-- document or not at all. Each filed row names its document and goes with
-- it when the document is removed. Rows she already had are only linked
-- (documents.metadata.linked) and never removed by it.
--
-- Security invoker: every table here already has owner RLS for insert,
-- update and delete, so this runs with exactly her rights.

alter table public.conditions add column document_id uuid references public.documents (id) on delete cascade;
alter table public.medications add column document_id uuid references public.documents (id) on delete cascade;
alter table public.procedures add column document_id uuid references public.documents (id) on delete cascade;
alter table public.referrals add column document_id uuid references public.documents (id) on delete cascade;

-- Medications refuse a provenance the app could claim falsely. DOCUMENT is
-- allowed only on a row that names the document it came from.
alter table public.medications drop constraint medications_provenance_client_check;
alter table public.medications add constraint medications_provenance_client_check
  check (provenance in ('MEASURED', 'REPORTED', 'RECORDED', 'IMPORTED') or (provenance = 'DOCUMENT' and document_id is not null));

create function public.save_document(
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

  update public.medications set stopped_on = p_occurred_on
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

  -- Health Details shows her kept lists once she has edited them; what was
  -- filed is added to them so it is visible there too.
  select array_agg(x->>'name') into added_conditions from jsonb_array_elements(coalesce(f->'conditions', '[]'::jsonb)) x;
  select array_agg(x->>'name') into added_meds from jsonb_array_elements(coalesce(f->'medications', '[]'::jsonb)) x where x->>'stopped_on' is null;
  update public.profiles p set onboarding = jsonb_set(
      jsonb_set(p.onboarding, '{details,conditions}',
        coalesce(p.onboarding->'details'->'conditions', '[]'::jsonb)
        || coalesce((select jsonb_agg(n) from unnest(added_conditions) n where not (coalesce(p.onboarding->'details'->'conditions', '[]'::jsonb) ? n)), '[]'::jsonb),
        p.onboarding->'details' ? 'conditions'),
      '{details,medications}',
      coalesce(p.onboarding->'details'->'medications', '[]'::jsonb)
      || coalesce((select jsonb_agg(n) from unnest(added_meds) n where not (coalesce(p.onboarding->'details'->'medications', '[]'::jsonb) ? n)), '[]'::jsonb),
      p.onboarding->'details' ? 'medications')
  where p.id = me and p.onboarding ? 'details';

  return doc;
end $$;

revoke execute on function public.save_document(text, text, date, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_document(text, text, date, text, jsonb, jsonb, jsonb) to authenticated;

-- Removing a document: what it filed goes with it by the cascade; rows it
-- only linked stay. Returns the stored file's path for the app to delete,
-- or null when the document was not hers.
create function public.remove_document(p_document uuid) returns text
language plpgsql security invoker set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  path text;
begin
  select storage_path into path from public.documents
  where id = p_document and user_id = me and doc_type <> 'lab_report';
  if path is null then
    return null;
  end if;
  delete from public.documents where id = p_document and user_id = me;
  return path;
end $$;

revoke execute on function public.remove_document(uuid) from public, anon;
grant execute on function public.remove_document(uuid) to authenticated;
