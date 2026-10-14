-- Two widenings, each for something the app now keeps.
--
-- Her provider chart: beyond labs, conditions, medicines, allergies,
-- immunisations, procedures and vitals, Ciatta now reads diagnostic reports,
-- clinical notes, visits, appointments, devices, family history, goals,
-- care plans and coverage. Each is a kind of clinical record.
alter table public.clinical_records drop constraint if exists clinical_records_kind_check;
alter table public.clinical_records add constraint clinical_records_kind_check check (
  kind in (
    'lab', 'condition', 'medication', 'allergy', 'immunization', 'procedure', 'vital',
    'report', 'note', 'encounter', 'appointment', 'device', 'family_history', 'goal', 'care_plan', 'coverage'
  )
);

-- Her body and personal details: units are now metric or imperial (us and
-- uk, the old choices, are still read as imperial), and she can keep her
-- ethnicity, gender and preferred language beside her measurements.
alter table public.profiles drop constraint if exists profiles_body_check;
alter table public.profiles add constraint profiles_body_check check (
  body is null
  or (
    jsonb_typeof(body) = 'object'
    and body - array['blood_type', 'height_cm', 'weight_kg', 'weight_on', 'units', 'ethnicity', 'gender', 'language'] = '{}'::jsonb
    and (body -> 'blood_type' is null or (jsonb_typeof(body -> 'blood_type') = 'number' and (body ->> 'blood_type')::int between 1 and 8))
    and (body -> 'height_cm' is null or (jsonb_typeof(body -> 'height_cm') = 'number' and (body ->> 'height_cm')::numeric between 50 and 260))
    and (body -> 'weight_kg' is null or (jsonb_typeof(body -> 'weight_kg') = 'number' and (body ->> 'weight_kg')::numeric between 2 and 400))
    and (body -> 'weight_on' is null or (body ->> 'weight_on') ~ '^\d{4}-\d{2}-\d{2}$')
    and (body -> 'units' is null or (body ->> 'units') in ('metric', 'imperial', 'us', 'uk'))
    and (body -> 'ethnicity' is null or (body ->> 'ethnicity') in (
      'african_black', 'east_asian', 'south_asian', 'southeast_asian', 'hispanic_latino', 'middle_eastern',
      'indigenous', 'pacific_islander', 'white_european', 'mixed', 'another', 'prefer_not'))
    and (body -> 'gender' is null or (body ->> 'gender') in (
      'woman', 'man', 'non_binary', 'trans_woman', 'trans_man', 'intersex', 'another', 'prefer_not'))
    and (body -> 'language' is null or (jsonb_typeof(body -> 'language') = 'string' and length(body ->> 'language') between 1 and 60))
  )
);
