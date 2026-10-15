-- From the branch review: store_lab_analysis was granted to authenticated,
-- so a signed in person could store any text as an analysis of her own
-- report by calling it directly, skipping the check entirely. Now only the
-- lab-analysis function can store one: it calls this with the server's
-- key, after checking the analysis, for the person its verified token
-- names. The report must still be that person's.

drop function public.store_lab_analysis(uuid, text, text, jsonb);

create function public.store_lab_analysis(p_user uuid, p_document uuid, p_model text, p_facts_hash text, p_analysis jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
begin
  if p_user is null or not exists (select 1 from public.documents where id = p_document and user_id = p_user) then
    raise exception 'not her report' using errcode = '42501';
  end if;
  insert into public.lab_analyses (user_id, document_id, model, facts_hash, analysis)
  values (p_user, p_document, p_model, p_facts_hash, p_analysis)
  returning lab_analyses.id into new_id;
  return new_id;
end $$;
revoke execute on function public.store_lab_analysis(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.store_lab_analysis(uuid, uuid, text, text, jsonb) to service_role;
