-- Which of Ciatta's client ids a connection was made with. Epic issues a
-- production id and a non production id for the sandbox, and a refresh
-- must present the same id the connection was made with.
--
-- Not added to the authenticated grant. The phone has no use for it.

alter table public.provider_connections add column client_id text;

comment on column public.provider_connections.client_id is
  'The public SMART client id used at exchange, and so the one a refresh presents. Null on connections made before it was kept; the function then uses the first id it is configured with.';
