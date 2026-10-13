-- A night nothing measured sleep on is unknown, never zero hours.
--
-- The app's fold summed the minutes of every asleep sample in a night and
-- wrote the total whether or not there had been one. A phone with no watch
-- beside it records only that she was in bed, so such a night was written
-- as sleep_hours = 0, and an average taken over her nights counted each
-- of them as a night without sleep. The fold no longer writes it, and
-- ingest-health refuses it from the builds that still do. This clears
-- what is already stored and keeps it from coming back.
--
-- time_in_bed on those rows is left as it is: that much was measured.

update public.daily_metrics set sleep_hours = null where sleep_hours <= 0;

alter table public.daily_metrics
  add constraint daily_metrics_sleep_hours_measured check (sleep_hours is null or sleep_hours > 0);
