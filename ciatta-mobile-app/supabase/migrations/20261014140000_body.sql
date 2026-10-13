-- Her body measurements as she entered them, and the units she reads them
-- in. Apple Health is the other source; what she enters here is hers and is
-- shown as entered by her. Stored once, in centimetres and kilograms.
-- Shape: { blood_type?: 1..8 (HealthKit HKBloodType), height_cm?: 50..260,
--          weight_kg?: 2..400, weight_on?: date, units?: metric | us | uk }
alter table public.profiles add column body jsonb
  check (
    body is null
    or (
      jsonb_typeof(body) = 'object'
      and body - array['blood_type', 'height_cm', 'weight_kg', 'weight_on', 'units'] = '{}'::jsonb
      and (body -> 'blood_type' is null or (jsonb_typeof(body -> 'blood_type') = 'number' and (body ->> 'blood_type')::int between 1 and 8))
      and (body -> 'height_cm' is null or (jsonb_typeof(body -> 'height_cm') = 'number' and (body ->> 'height_cm')::numeric between 50 and 260))
      and (body -> 'weight_kg' is null or (jsonb_typeof(body -> 'weight_kg') = 'number' and (body ->> 'weight_kg')::numeric between 2 and 400))
      and (body -> 'weight_on' is null or (body ->> 'weight_on') ~ '^\d{4}-\d{2}-\d{2}$')
      and (body -> 'units' is null or (body ->> 'units') in ('metric', 'us', 'uk'))
    )
  );
