# Environment and exposures, phase one

Date: 2026-10-13
App: `ciatta-mobile-app` (Expo 57, React Native)
Status: design approved in conversation, awaiting spec review

## Goal

Ciatta keeps the background a stretch of her life happened against: the
weather, how much daylight there was, and damp or mould at home where she
knows it. None of it is about her body. It appears where she asks why a
pattern happened, as one factual line, and only when that stretch was
unusual for her.

Phase one uses Apple WeatherKit (the data source behind Apple's Weather
app) plus her own Apple Health daylight. Air quality, wildfire smoke and
pollen are phase two, once a provider is chosen; they add columns to the
same daily row.

## Constraints

- Keep Jost and the existing design; reuse `ui/kit.tsx`, `ui/chrome.tsx`.
- UI copy has no em dash, en dash or hyphen, and passes through `displayCopy()`.
- Environment data is never described as being about her body, and no
  line says or implies the environment caused anything. It sits under
  "Other explanations", never under "What supports this".
- Location is approximate only. Coordinates are rounded on the phone to
  one decimal place (about 10 km) before they leave it, and are never stored
  anywhere.
- iOS apps cannot read the Weather app itself. WeatherKit is the supported
  route to the same data.
- Where a value cannot be found in the provider's response, it is stored as
  null, never estimated.

## 1. Data

New table `environment_days`, one row per person per day:

```sql
create table public.environment_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  provenance public.provenance not null default 'IMPORTED',
  temp_max_c numeric,
  temp_min_c numeric,
  humidity_mean numeric check (humidity_mean between 0 and 1),
  condition text,
  daylight_minutes numeric,         -- sunrise to sunset, from WeatherKit
  source text not null default 'WeatherKit',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);
```

Owner select only for `authenticated`; writes come only from the server
function under `service_role` (same model as `daily_metrics`).

Her measured daylight is not environment: Apple Health's
`timeInDaylight` (iOS 17, Apple Watch) is a reading of her, so it joins
the existing HealthKit sync as a `daily_metrics` column `daylight_minutes`
with provenance MEASURED. If the HealthKit library in use does not expose
that type, this item is dropped from phase one and noted, not approximated.

Damp and mould are hers to report: a new Context chip, `Damp or mould at
home`, in `lib/logCategories.ts`, with a sentence cue
(`damp|mou?ld|mildew`). It is stored like every other Context item.

## 2. Fetching

Server function `supabase/functions/environment`:

- Authenticated POST `{ lat, lon, from, to }`. Rejects lat or lon with more
  than one decimal place, ranges longer than 120 days, and dates in the
  future.
- Signs a WeatherKit JWT (ES256) from secrets `WEATHERKIT_KEY_ID`,
  `WEATHERKIT_TEAM_ID`, `WEATHERKIT_SERVICE_ID`, `WEATHERKIT_PRIVATE_KEY`.
- Requests the daily and hourly data sets for the range, maps each day to
  the columns above (humidity is the mean of that day's hourly values;
  daylight is sunset minus sunrise), and upserts rows for the caller's
  `user_id` only. The coordinates are used for the request and discarded.

The phone calls it:

- On first permission grant: the last 90 days (backfill), so existing
  patterns get background immediately.
- Then at most once a day when the app comes to the front: any days since
  the newest stored row, through yesterday.

Location permission (`expo-location`, foreground, reduced accuracy) is
asked from a row in Profile → Settings, "Weather and daylight", with one
line saying why and that only an approximate area is used. Declining
changes nothing else in the app.

## 3. Where she sees it

`lib/environmentContext.ts` (pure):

`environmentLine(stretch: { from: string; to: string }, days: EnvironmentDay[]): string | null`

- Her usual is the 90 days before the stretch: the band (`band()` from
  `lib/engine.ts`) of daily max temperature, of mean humidity, and of
  daylight minutes.
- A dimension is unusual when the stretch's mean lies outside that band.
- At least 60% of the stretch's days must have a row, and the usual at
  least 30 rows, or the result is null.
- Wording names only what was unusual, with the figures, against her usual:
  "Those two weeks were hotter and more humid than your usual (31 °C,
  80%)." "Days were shorter than your usual (9h of daylight)."
- Null when nothing was unusual. Nothing is shown in that case.

`EvidenceScreen` appends the line to "Other Explanations" for the shown
pattern, using the pattern's date span. A small source footer names
WeatherKit (Apple requires attribution: the Apple Weather mark and a
link to its legal attribution page).

## 4. Testing

- Unit: `environmentLine` (unusual hot, humid, short days; nothing unusual
  gives null; too few rows gives null; no causal words; no dashes); the
  WeatherKit response mapper (fixture JSON to rows; missing fields to null).
- SQL: `environment_days` RLS (owner reads, client cannot write).
- Function: rejects precise coordinates, long ranges, future dates.

## Out of scope (phase two and later)

Air quality and pollution, wildfire smoke, pollen, a dashboard card, a
Journey lane, and Care answering from environment data.
