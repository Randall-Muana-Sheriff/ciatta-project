-- A lab report she added: one documents row, and its results pointing at
-- it, written together or not at all. The file itself is uploaded by the
-- app to the private documents bucket first, under her own folder; this
-- refuses any path outside it.
--
-- Security invoker: documents and results already carry owner RLS for
-- insert and delete, so these run with exactly her rights, and the
-- function only adds the all or nothing.

create function public.save_lab_report(
  p_title text,
  p_collected_on date,
  p_storage_path text,
  p_metadata jsonb,
  p_tests jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  doc uuid;
  at timestamptz := (p_collected_on::text || 'T12:00:00Z')::timestamptz;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_storage_path is null or split_part(p_storage_path, '/', 1) <> me::text then
    raise exception 'not her file' using errcode = '42501';
  end if;
  if jsonb_typeof(p_tests) <> 'array' or jsonb_array_length(p_tests) = 0 then
    raise exception 'no results' using errcode = '22023';
  end if;

  insert into public.documents (user_id, storage_path, title, doc_type, extraction_status, occurred_at, metadata)
  values (me, p_storage_path, p_title, 'lab_report', 'extracted', at, coalesce(p_metadata, '{}'::jsonb))
  returning id into doc;

  insert into public.results (
    user_id, document_id, test_name, panel, value, value_text, unit,
    reference_low, reference_high, reference_text, flag, status, provider, source, occurred_at
  )
  select
    me, doc, t->>'name', nullif(t->>'panel', ''), (t->>'value')::numeric, t->>'value_text', t->>'unit',
    (t->>'low')::numeric, (t->>'high')::numeric, t->>'range', t->>'flag', 'final', p_metadata->>'lab', 'report', at
  from jsonb_array_elements(p_tests) as t;

  return doc;
end $$;

revoke execute on function public.save_lab_report(text, date, text, jsonb, jsonb) from public, anon;
grant execute on function public.save_lab_report(text, date, text, jsonb, jsonb) to authenticated;

-- Removing a report: its results, then the report. results.document_id is
-- on delete set null, so the results are deleted here rather than left
-- behind as labs with no report. Returns the stored file's path for the
-- app to delete from storage, or null when the report was not hers.
create function public.remove_lab_report(p_document uuid) returns text
language plpgsql security invoker set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  path text;
begin
  select storage_path into path from public.documents
  where id = p_document and user_id = me and doc_type = 'lab_report';
  if path is null then
    return null;
  end if;
  delete from public.results where document_id = p_document and user_id = me;
  delete from public.documents where id = p_document and user_id = me;
  return path;
end $$;

revoke execute on function public.remove_lab_report(uuid) from public, anon;
grant execute on function public.remove_lab_report(uuid) to authenticated;

create index documents_lab_checksum on public.documents (user_id, (metadata->>'checksum'))
  where doc_type = 'lab_report';
