-- Task 6 review: daily_metrics granted authenticated insert and update
-- (from enable_owner_rls, which every earlier table also used), so the
-- client could write temp_deviation -- a column the baselines function
-- derives from her own baseline -- and could overwrite any measured column
-- device sync owns. Nothing in the app writes daily_metrics today: device
-- data arrives through the ingest-health edge function under the service
-- role, and the baselines function writes the deviation. So the client's
-- write is revoked entirely and the table stays readable.
revoke insert, update, delete on public.daily_metrics from authenticated;
grant select on public.daily_metrics to authenticated;
grant all on public.daily_metrics to service_role;

-- Drop the owner write policies too, not just the grants, so the table's
-- policy set matches what it actually allows and a future migration can't
-- restore write access by accident through a grant alone (a stray `grant
-- insert on public.daily_metrics to authenticated` would do nothing while
-- these policies are gone, whereas it would silently reopen writes if the
-- policies were still sitting here from enable_owner_rls).
-- `if exists` on all three: this migration has not been applied anywhere
-- yet, and on the live project a single name that does not match would
-- abort the whole file part way through, leaving the grants above applied
-- and the policies behind them still standing.
drop policy if exists "owner insert" on public.daily_metrics;
drop policy if exists "owner update" on public.daily_metrics;
drop policy if exists "owner delete" on public.daily_metrics;
-- "owner select" stays: she still reads her own rows.

-- When self reported check ins are built, the columns she fills in herself
-- (energy, mood, stress, caffeine, alcohol, foods, digestion, note) get
-- granted back explicitly, per column (`grant update (energy, mood, ...) on
-- public.daily_metrics to authenticated` plus a matching policy), rather
-- than reopening the whole table.
