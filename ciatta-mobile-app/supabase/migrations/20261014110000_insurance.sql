-- Her health insurance, entered by her on her Profile: the insurer, the
-- plan, and the member ID if she wants it kept with her record. Read and
-- written by her alone under the profile's owner policies.
-- Shape: { provider: text (required), plan?: text, member_id?: text }.
alter table public.profiles add column insurance jsonb
  check (
    insurance is null
    or (
      jsonb_typeof(insurance) = 'object'
      -- coalesce, because a missing key compares as unknown, and a check
      -- lets unknown through.
      and coalesce(jsonb_typeof(insurance -> 'provider') = 'string', false)
      and coalesce(length(trim(insurance ->> 'provider')) between 1 and 120, false)
      and (insurance -> 'plan' is null or (jsonb_typeof(insurance -> 'plan') = 'string' and length(insurance ->> 'plan') <= 120))
      and (insurance -> 'member_id' is null or (jsonb_typeof(insurance -> 'member_id') = 'string' and length(insurance ->> 'member_id') <= 60))
    )
  );
