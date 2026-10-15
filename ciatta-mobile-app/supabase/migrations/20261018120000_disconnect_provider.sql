-- Removing a provider. The connect sheet and Privacy both tell her she can,
-- and this is what does it: the connection, every record it sent, and its
-- labs in her results. Nothing is changed at her provider.
--
-- Security definer because the client has no delete grant on any of these
-- tables, and must not: a delete the app could aim would be a way to empty
-- someone's chart. Every statement is scoped to auth.uid(), and a
-- connection that is not hers is a plain false, not an error that says it
-- exists.
--
-- clinical_records go with the connection by on delete cascade. Provider
-- labs in results have no foreign key, so they are deleted by the
-- connection id that prefixes their source_ref.

create function public.disconnect_provider(p_connection uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    return false;
  end if;
  if not exists (select 1 from public.provider_connections where id = p_connection and user_id = me) then
    return false;
  end if;

  delete from public.results
  where user_id = me and source = 'provider' and source_ref like p_connection::text || ':%';

  delete from public.provider_connections where id = p_connection and user_id = me;
  return true;
end $$;

revoke execute on function public.disconnect_provider(uuid) from public, anon;
grant execute on function public.disconnect_provider(uuid) to authenticated;
