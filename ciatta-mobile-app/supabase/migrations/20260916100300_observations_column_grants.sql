-- Slice 2 review: the ingest function's observation allowlist
-- (buildObservationRow in supabase/functions/ingest-health/batch.ts) keeps a
-- client from forging origin_table, origin_id and data_quality, but it only
-- covers the path through that function. 20260915100400_exact_grants.sql
-- granted `insert on public.observations to authenticated` with no column
-- restriction, and the "owner adds facts" policy constrains only user_id and
-- provenance, so a client could POST straight to PostgREST with those
-- columns set and never touch the edge function. No cross user reach (RLS
-- still holds), but origin_table and origin_id are the evidence trail from a
-- finding back to the measurement behind it, and a trail a client can write
-- is not evidence.
--
-- Revoke then grant, never additive, as everywhere else in this project: a
-- column level grant does not narrow a table level one that is still
-- standing, it sits beside it.
revoke insert on public.observations from authenticated;

-- Exactly the columns a client legitimately writes: her own identity, the
-- fact itself, when it happened, where it came from and how it is deduped.
-- Everything left out is server owned: origin_table and origin_id (written
-- by the database triggers that materialise an observation from an episode
-- or a journal entry), data_quality, id, created_at and updated_at.
grant insert (
  user_id, domain, metric, value, value_text, unit, occurred_at,
  source_id, provenance, dedupe_key, metadata
) on public.observations to authenticated;

-- select is unchanged: she still reads every column of her own rows,
-- including the origin columns, which is how a finding can show its
-- evidence back to her.
