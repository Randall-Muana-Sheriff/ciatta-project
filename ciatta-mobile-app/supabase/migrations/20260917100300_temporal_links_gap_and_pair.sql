-- Fix round 1 on the temporal links table. Two guards that both want to be
-- in place before anything starts writing rows, because both of them catch
-- an upstream bug at the moment it happens rather than letting it sit in her
-- record and quietly skew a thread later.

-- 1. The gap has to agree with the relation it claims. Without this a row
-- can say same_day and carry 900 hours, and the two halves of the same row
-- contradict each other.
--
-- Three things here are deliberate.
--
-- same_day is absent on purpose. It names a calendar day, not a duration,
-- and a calendar day runs to 25 or 26 hours across a daylight saving
-- change. Any number bounding it would be a fact about the timezone
-- database rather than a fact about her record, so there is nothing
-- truthful to write.
--
-- There is no overall cap. recurring spans weeks by definition, so a
-- ceiling over every relation would reject every recurring row the moment
-- the next slice produces one.
--
-- The else true is written out rather than left off. A case whitelist with
-- no else yields NULL for any value it does not list, and a check that
-- evaluates to NULL passes. Leaving it off would behave correctly today
-- only by accident, and would silently stop doing so the first time the
-- enum gains a value.
--
-- Upper bounds only. same_day and within_24h genuinely overlap, so a lower
-- bound would reject rows that are perfectly legitimate.
alter table public.temporal_links
  add constraint temporal_links_gap_matches_relation check (
    case relation
      when 'within_24h' then gap_hours <= 24
      when 'within_3d'  then gap_hours <= 72
      when 'within_7d'  then gap_hours <= 168
      else true
    end
  );

-- 2. A pair is recorded once, whichever way round it arrives.
--
-- The table already carries unique (user_id, a_observation_id,
-- b_observation_id, relation), but that only stops an exact repeat. The
-- same two observations inserted the other way round have different column
-- values, so it lets them both in and the pair lands twice.
--
-- The ordering rule, that a is always the earlier observation, was meant to
-- prevent this, but the database cannot check it without joining back to
-- observations. The property that actually causes harm is the narrower one,
-- that a pair is recorded once, and normalising the two ids with least and
-- greatest enforces exactly that with no join at all. Both are immutable
-- over uuid, so the expression index is accepted.
create unique index temporal_links_pair_once on public.temporal_links
  (user_id, least(a_observation_id, b_observation_id),
            greatest(a_observation_id, b_observation_id), relation);
