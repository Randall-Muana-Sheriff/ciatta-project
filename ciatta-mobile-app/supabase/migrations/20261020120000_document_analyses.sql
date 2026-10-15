-- The analysis of a document she added: written only by the
-- document-analysis function with the server's key after its check, read
-- only by her, removed with its document.

create table public.document_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  model text not null,
  facts_hash text not null,
  analysis jsonb not null,
  created_at timestamptz not null default now()
);
create index document_analyses_document on public.document_analyses (document_id, created_at desc);
alter table public.document_analyses enable row level security;
create policy document_analyses_own on public.document_analyses for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.document_analyses from anon, authenticated;
grant select on public.document_analyses to authenticated;
grant all on public.document_analyses to service_role;

create function public.store_document_analysis(p_user uuid, p_document uuid, p_model text, p_facts_hash text, p_analysis jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
begin
  if p_user is null or not exists (select 1 from public.documents where id = p_document and user_id = p_user) then
    raise exception 'not her document' using errcode = '42501';
  end if;
  insert into public.document_analyses (user_id, document_id, model, facts_hash, analysis)
  values (p_user, p_document, p_model, p_facts_hash, p_analysis)
  returning document_analyses.id into new_id;
  return new_id;
end $$;
revoke execute on function public.store_document_analysis(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.store_document_analysis(uuid, uuid, text, text, jsonb) to service_role;
