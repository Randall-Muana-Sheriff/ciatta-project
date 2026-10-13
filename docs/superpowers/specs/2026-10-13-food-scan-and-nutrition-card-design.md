# Food scan and the Nutrition card

Date: 2026-10-13
App: `ciatta-mobile-app` (Expo 57, React Native)
Status: design approved in conversation, awaiting spec review
References: `ciatta-visual-assets/IMG_4911.jpg` (scan), `IMG_4912.jpg` (card),
`IMG_4823.PNG` (food photo header)

## Goal

When she photographs a meal under Nutrition, Ciatta names each food
on the photo the way IMG_4911 does (a frosted label pinned to each item, a
dotted ring around it) and estimates protein, carbs, fat and calories. The
Health dashboard's Nutrition card gains the IMG_4912 calories block: the
day's calories, protein and fat, and a dial, with her gut flags beneath.

## Decisions (from the conversation)

- Nutrition and Gut are separate categories (2026-10-13, built): Nutrition
  is food, drink and goals; Gut is digestion and bowel movements. Each has
  its own Log category and dashboard card.
- The Nutrition card opens with a real food photo (IMG_4823): her most
  recent photo logged under Nutrition, with a meal pill (Breakfast, Lunch,
  Dinner or Snack, by the hour) and the meal's name beneath. No photo, no
  header; never a stock image for a real account. Built.

- Photos are read by OpenAI's vision model, `gpt-4o` by default, through a
  server function. The key never reaches the phone.
- Every figure from a scan is an estimate, labelled as one wherever it
  appears, and editable before saving.
- Macro cards show what she ate. Only if she sets her own daily targets do
  they switch to "Left" with the ring filling toward her number. Ciatta
  never proposes or invents a target.
- The Calories block from IMG_4912 sits on the Nutrition card, under its photo.

## Constraints

- Keep Jost and the existing dark design; the references are layouts, not
  palettes. Rings use the metric hue system already on Today.
- UI copy has no em dash, en dash or hyphen, through `displayCopy()`.
  Numbers use a comma for thousands ("1,250").
- The attachment rule ("Ciatta does not read what is inside a file")
  changes for one case only: a photo taken or added under Nutrition, sent
  to be scanned. The scan screen says so. Photos anywhere else
  are still never read.
- The photo is sent once for the scan and not stored on the server or
  logged. It stays on the phone with the meal, like other attachments.

## 1. Data

New table `meals` (owner RLS, `unique (user_id, client_id)`):

| column | type | notes |
|---|---|---|
| `eaten_at` | timestamptz | when she ate, default now |
| `items` | jsonb | array of items, below |
| `kcal`, `protein_g`, `carbs_g`, `fat_g` | numeric | sums of items, for querying |
| `photo` | jsonb | the attachment reference (local URI), as elsewhere |
| `provenance` | provenance | `INFERRED` when any figure is a scan estimate she left as is; `REPORTED` when she typed every figure |

Item: `{ name, portion, kcal, protein_g, carbs_g, fat_g, at: { x, y, r } | null, from: 'estimated' | 'reported' }`.
`at` is the item's centre and radius as fractions of the photo, for the
label and ring; null when the model gave none (the item is listed but not
pinned). An item she edits becomes `from: 'reported'`.

Saving a meal also appends its item names to that day's foods through
`save_daily_log`, so the engine's food and bloating check sees them.

Targets: `profiles.nutrition_targets jsonb` (`{ kcal?, protein_g?,
carbs_g?, fat_g? }`), set by her in Profile → Settings → "Nutrition
targets", each optional, all blank by default.

## 2. The scan

Server function `supabase/functions/food-scan`:

- Authenticated POST `{ image: base64 jpeg }`, at most 1.5 MB after the
  phone resizes it to 1024 px on the long edge (`expo-image-manipulator`,
  a new native module: one rebuild).
- Calls the OpenAI Responses API with model `OPENAI_FOOD_MODEL`
  (default `gpt-4o`) and a strict JSON schema output:
  `{ items: [{ name, portion, kcal, protein_g, carbs_g, fat_g, x, y, r }], not_food: boolean }`.
  Instructions: name only foods visible; give a portion in words; estimate
  per item; x, y, r as fractions; set `not_food` when there is no meal.
- Validates the output (numbers finite and non negative, fractions in 0 to
  1, at most 12 items), drops anything invalid, and returns it. Nothing is
  stored. Secret `OPENAI_API_KEY`. Limit 40 scans per person per day.

Scan screen (`screens/FoodScanScreen.tsx`), laid out as IMG_4911:

- The photo full width. For each item with `at`: a dotted ring, a dot at
  its top, and a frosted pill label with the food's name above it.
- Bottom: three cards, Protein, Carbs, Fat. Each shows this meal's grams
  as the figure and an arc gauge. With no target the gauge shows this
  meal's share of today's total for that macro, captioned "of today".
  With her target it reads "{n} g {Macro} Left" for the day and fills
  toward the target.
- A small "Estimated" tag on the card row, and the line "Estimates from
  your photo. Tap a food to correct it."
- Tapping a label opens that item's name, portion and figures to edit, or
  remove. "Add a food" for anything missed.
- Save stores the meal and returns to Log.
- While scanning: the photo with a soft shimmer and "Reading your meal".
  `not_food`, a failed call or no network: "Ciatta could not read a meal
  in this photo" with "Add foods yourself", which opens the same screen
  with an empty list.

Entry points: under Nutrition on the Log screen, a "Scan a meal"
button (camera, or library), and any photo she adds there with the plus.

## 3. The Nutrition card (IMG_4823 header, IMG_4912 block)

On the Health dashboard, under the meal photo header, shown once she has
logged a meal or a Nutrition item in 30 days:

- Title "Calories" ("Calories Progress" when she has a kcal target), the
  open arrow to her meals list at top right.
- Today's kcal large ("1,250 KCAL"), with protein and fat grams beside it,
  and "Estimated" under the figure when any of it came from a scan.
- The dial: with a kcal target, the arc fills toward it. Without one, the
  arc fills toward her usual day (median kcal of her logged days, at least
  7 of them in 30), marked "Your usual 1,800". With neither, no dial.
- Beneath: her Nutrition items for 30 days (caffeine, alcohol, skipped
  meals, eating late). Gut flags and bowel movements are on the Gut card.
- "From your record" in place of "AI Chef's Tips": one line, only when her
  own record supports it, from a fixed set: protein under her target on
  most logged days this week; or the engine's food and bloating finding
  when it is surfaced. Otherwise absent. No generic diet advice.

## 4. Testing

- Unit: output validation (bad numbers, fractions out of range, more than
  12 items, not_food); item edits flip `from`; meal sums; the macro card
  mode (totals, share of today, Left with a target); usual day median and
  its threshold; card line selection; number formatting; no dashes.
- SQL: `meals` RLS; `nutrition_targets` readable and writable only by her.
- Function: rejects unauthenticated calls, oversize images, the daily cap.
- Device: one real scan of a plate, checked against IMG_4911 by eye.

## Out of scope

Barcode scanning, recipe import, micronutrients, water tracking, weekly
nutrition reports, and suggesting targets.
