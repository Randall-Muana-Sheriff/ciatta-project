-- Finish the function lockdown started in 20260915100300. Every other
-- function in this schema had its default grant revoked there; this is the
-- one that was missed. A function left at its default is callable through
-- PostgREST (/rpc) by anyone the Data API will speak to.
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- And take the standing execute grant off the next function added here.
-- PUBLIC is revoked alongside the two roles because Postgres grants EXECUTE
-- on a new function to PUBLIC, and anon and authenticated are both members
-- of it: revoking from the two roles alone would leave that grant in place.
-- On a hosted project this is the clause that matters, since its legacy
-- default privileges hand anon and authenticated EXECUTE outright.
--
-- Two things it does not do, which is why every function also gets its own
-- explicit revoke above and why supabase/tests/grants.test.sql sweeps every
-- function in the schema rather than trusting this line:
--   * default privileges are per creating role, and the local stack carries
--     a set owned by supabase_admin that grants anon and authenticated
--     EXECUTE. A migration runs as postgres and cannot change those
--     ("permission denied to change default privileges"), so a function
--     created by supabase_admin is still exposed.
--   * locally a new function created by postgres still comes back with the
--     built-in default ACL despite this revoke, so the sweep, not this
--     clause, is what actually catches a newly exposed function.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
