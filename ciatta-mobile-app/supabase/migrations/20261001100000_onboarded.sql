-- When she went through the first steps after sign in, or null when she
-- has not. Kept on the server so a reinstall or a second phone does not
-- repeat them. Owner updatable through the existing "owner update" policy
-- on profiles, exactly as first_name is; no new policy and no new grant.
alter table public.profiles add column onboarded_at timestamptz;
