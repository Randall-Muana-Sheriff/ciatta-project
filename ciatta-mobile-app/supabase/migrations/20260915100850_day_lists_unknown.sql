-- Review finding on Task 1: daily_metrics.workouts, .foods and .digestion
-- defaulted to an empty list, so a day written by device sync could not
-- distinguish "Apple Health reported no workouts" from "we have not synced
-- workouts yet". Null means unknown, and a value is never substituted for
-- one she did not give. Dropping the default and the not null constraint
-- leaves every existing row's value exactly as it is; only future inserts
-- that omit these columns now land as null instead of an empty list.
alter table public.daily_metrics
  alter column workouts drop default,
  alter column workouts drop not null,
  alter column foods drop default,
  alter column foods drop not null,
  alter column digestion drop default,
  alter column digestion drop not null;
