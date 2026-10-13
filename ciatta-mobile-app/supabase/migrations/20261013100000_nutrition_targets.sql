-- Her own daily nutrition targets, all optional, set by her in Settings.
-- Ciatta never proposes one; with none set, the app shows what she ate.
-- Shape: { kcal?, protein_g?, carbs_g?, fat_g? }, numbers, checked in the
-- app (lib/nutritionTargets.ts) and here for type.
alter table public.profiles add column nutrition_targets jsonb
  check (nutrition_targets is null or jsonb_typeof(nutrition_targets) = 'object');
