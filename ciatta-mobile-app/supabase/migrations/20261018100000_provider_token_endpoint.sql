-- Where a connection's tokens are refreshed. Each provider names its own
-- token address in its SMART configuration, and it is not under the FHIR
-- base: Epic's is .../oauth2/token beside .../api/FHIR/R4. Without it a
-- refresh went to a guessed address, failed, and marked the connection
-- expired an hour after she made it.
--
-- Not added to the authenticated grant. The phone has no use for it.

alter table public.provider_connections add column token_endpoint text;

comment on column public.provider_connections.token_endpoint is
  'The token address from the provider''s .well-known/smart-configuration, kept at exchange so a refresh goes where the provider said. Null on connections made before it was kept; the function then asks the provider again.';
