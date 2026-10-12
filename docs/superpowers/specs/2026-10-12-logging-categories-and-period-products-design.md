# Logging by category, period products, and product safety

Date: 2026-10-12
App: `ciatta-mobile-app` (Expo 57, React Native)
Status: design approved in conversation, awaiting spec review

## Goal

Logging is organised by what it is about, not by which screen happens to hold
it. Period products become a first class part of the Cycle category, because
how often she changes and at what absorbency is her individual menstrual
picture and is data her clinician uses to assess heavy bleeding. While a
product is in, Ciatta keeps a sourced safety window and reminds her through
local phone notifications before that window closes.

## Constraints

- Keep Jost and the existing design. New UI reuses `ui/kit.tsx`,
  `ui/chrome.tsx`, `ui/bento.tsx`, `ui/metricCard.tsx` and the shared
  `ui/composer.tsx` box (the Care box: one line at rest, plus and mic).
- UI copy has no em dash, en dash or hyphen, and passes through `displayCopy()`.
- Logged items are `reported`. Nothing is inferred from absence or from a
  device. Everything the sentence reader recognises is shown before saving.
- The app never names a diagnosis. Safety flags say what the source says
  and point to care; they do not diagnose.
- Safety content ships without a clinical review step (decision 2026-10-12).
  The compensating rule: every number and warning is taken from its source
  as written, cites that source in the UI, and is never softened, rounded
  toward convenience, or extended past what the source states.
- Existing saved data (episodes, daily logs, journal entries) must still load.

## Delivery

Three pieces, each with its own implementation plan, built in order. Each
works without the next.

1. Categories: the Log screen and sentence reader reorganised into eight
   categories, with gut logging merged into one place.
2. Period products: data, Cycle category UI, Today card, clinician summary.
3. Product safety: the rules file, timer, notifications and flags.

---

## 1. Categories

### The eight

| Key | Label | Holds | Status today |
|---|---|---|---|
| `cycle` | Cycle | Bleeding kind and flow, period products (piece 2), ovulation test | Bleeding and flow exist in `data/cycleLog.ts` |
| `nutrition` | Nutrition and gut | Meals, caffeine, alcohol, water; digestion flags; Bristol stool type, bowel pain, bowel flags | Split between `lib/dailyLog.ts` and the cycle questionnaire; merged here |
| `body` | Body | Pain (location, sensation, 0 to 10, affect); physical symptoms | Pain exists; symptom list expanded |
| `mind` | Mind | Cognitive and neuro; mood and check ins | Check ins exist; items below are new |
| `skin` | Skin and hair | Skin and hair changes | New |
| `sexual` | Sexual and urinary health | Sexual and urinary symptoms | New |
| `context` | Context | Sleep as she felt it, exercise, stressful events, travel, medications or supplements taken, sex | Partly read from notes by `readNote`; made explicit |
| `note` | Note | Free text | Exists (journal) |

New vocabularies (chips), in `lib/logCategories.ts`:

- Body symptoms: Breast tenderness, Hot flashes, Night sweats, Fatigue,
  Nausea, Chills, Swelling, Joint pain.
- Mind: Brain fog, Memory lapses, Hard to focus, Headache, Migraine,
  Dizziness, Tingling or numbness, Low mood, Anxiety, Irritability, Mood swings.
  Energy, mood and stress keep their existing one to five check ins.
- Skin and hair: Acne, Oily skin, Dry skin, Hair shedding, Unwanted hair
  growth, Dark patches, Itching.
- Sexual and urinary: Pain with sex, Low libido, Vaginal dryness, Discharge
  change, Urinary urgency, Leaking, Burning when peeing, Bleeding after sex.
- Context: Slept badly, Slept well, Exercised, Stressful event, Travel,
  Took medication, Took supplement, Sex, Illness. Alcohol lives in Nutrition.

### Data

A category entry is stored where its kind already lives, so nothing existing
moves tables:

- `cycle`, `body` pain: episodes (`episodes` table, unchanged shape).
- `nutrition`: the daily log. Bowel fields in new cycle episodes stop being
  offered (old episodes keep theirs and still load).
- `mind`, `skin`, `sexual`, `context`, `note`: `journal_entries`, with
  `metadata.category` and `metadata.items: string[]` (chips she tapped). The
  `kind` column keeps its check constraint: `mind`, `skin`, `sexual` and
  `body` symptoms map to `Symptoms`; `context` maps to `Context`; `note` to
  `Notes`.

Fix carried in with this piece: the Daily Log screen's Save button currently
saves nothing (`DailyLogScreen.tsx` calls `nav.back()`). Nutrition and gut
entries must persist; this piece adds the save path.

### Log screen

- Header: category chips in a horizontal scroller, replacing the three
  segment control in `QuickLogScreen.tsx`. Default `cycle`.
- Under the chips: that category's quick chips (multi select), then the
  shared box with its example sentence as placeholder, then the recognised
  line, then the link to the category's detailed form where one exists
  (`cycleLog`, `dailyLog`, `journal`).
- One sentence may touch several categories. `lib/quickLog.ts` gains a reader
  per category; the "Will be saved as" line groups what it found by category.
  Text with no recognised words is filed under the selected category.

---

## 2. Period products

### Vocabulary (`lib/periodProducts.ts`)

| Type | Sizes |
|---|---|
| Pad | Liner, Light, Regular, Heavy, Overnight, Extra long |
| Tampon | Light, Regular, Super, Super plus, Ultra (FDA standard absorbency terms) |
| Cup | Small, Large |
| Disc | Small, Large |
| Period underwear | Light, Moderate, Heavy, Overnight |

Fullness at removal: Not full, Partly full, Soaked, Leaked. Optional.

### Data

New table `product_uses`, with the same ownership, RLS and `client_id`
uniqueness pattern as `journal_entries`:

```sql
create table public.product_uses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null,
  provenance public.provenance not null default 'REPORTED',
  product text not null check (product in ('Pad', 'Tampon', 'Cup', 'Disc', 'Period underwear')),
  size text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  fullness text check (fullness in ('Not full', 'Partly full', 'Soaked', 'Leaked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id),
  check (ended_at is null or ended_at >= started_at)
);
```

At most one open use (`ended_at is null`) per user; starting a new one closes
the open one at the new `started_at`. Enforced in the repo and by a partial
unique index on `(user_id) where ended_at is null`.

Repo additions (`data/repo.ts`, demo and real): `loadProductUses(since)`,
`startProduct(product, size, at)`, `endProduct(at, fullness)`. Demo serves
sample uses across the sample's last period.

### Cycle category UI

Above the box: "What are you using?" product chips, then size chips for the
chosen product, then two actions: **Put in now** and **Changed earlier**
(time picker, today only, not in the future). The sentence reader also
recognises "changed a super tampon", "put in my cup", "new overnight pad".

### Today card

Shown only while a use is open, above Metrics, in the existing tile style:

- Product and size, time in ("In for 3h 20m"), "Change by 4:40 PM".
- **Changed it**: ends the use and starts the same product and size now.
- **Removed**: ends the use, asks fullness (skippable).
- "Safety" link to the product's rules (piece 3).

### Clinician value

Per period, counted from logs only, added to the record the agent reads
(`lib/agent/record.ts`) and the appointment brief:

"Period, 3 to 8 Oct: 6 to 8 changes a day, mostly Super tampon. Soaked
within 2 hours on days 1 and 2."

Days with no product logged say nothing rather than zero.

---

## 3. Product safety

### Rules (`lib/productSafety.ts`)

Static and typed. Each rule has its numbers, its user facing wording, and a
`source` (title, publisher, URL). The agent may quote a rule; it may not
compose safety advice of its own.

| Product | Window | Reminders | Source |
|---|---|---|---|
| Tampon | Change every 4 to 8 hours; never longer than 8 | Nudge at 6 h, firm at 8 h | FDA, 21 CFR 801.430 (tampon labeling); FDA consumer page "The Facts on Tampons and How to Use Them Safely" |
| Cup | Up to 12 hours | Nudge at 10 h, firm at 12 h | Manufacturer labeling of FDA cleared menstrual cups |
| Disc | Up to 12 hours | Nudge at 10 h, firm at 12 h | Manufacturer labeling |
| Pad | Every 4 to 8 hours | Gentle at 6 h | ACOG patient guidance on menstrual products |
| Period underwear | Up to 12 hours | Gentle at 10 h | Manufacturer labeling |

Further rules:

- **Lowest absorbency** (FDA labeling): a tampon removed Not full after 6 or
  more hours gets one quiet line suggesting a lower absorbency next time.
- **Overnight** (FDA consumer guidance): a tampon started after 9 PM shows
  "If you might sleep longer than 8 hours, a pad or cup is the safer choice
  overnight."
- **TSS warning signs** (FDA labeling): sudden high fever, vomiting,
  diarrhea, a rash like a sunburn, dizziness or fainting, muscle aches.
  Always reachable from the Today card. Logging any of these in any
  category while a tampon, cup or disc is open shows "Remove it and get
  medical care now" through the existing `escalate` path in Care.
- **Cup and IUD** (van Eijk et al., Lancet Public Health 2019): when the
  cycle profile's contraception is an IUD, one time note on first cup use
  that suction on removal has been reported to move an IUD, and to break the
  seal before removing.
- **Heavy bleeding** (CDC and ACOG heavy menstrual bleeding criteria):
  two or more consecutive uses ended Soaked or Leaked within 1 hour or less
  flags "Soaking through this fast is worth telling your clinician. If you
  feel faint or dizzy, get care now." Counted only from her logs.

Exact source URLs and quoted wording are captured in the file during
implementation from the primary pages; where a number cannot be found in the
cited source, the rule is dropped rather than approximated.

### Timer and notifications

- `lib/productTimer.ts` (pure): given an open use and now, returns elapsed,
  the change by time, the stage (`ok`, `nudge`, `firm`, `over`), and the
  reminder times to schedule.
- `lib/reminders.ts` wraps `expo-notifications` behind an interface so tests
  run without a device. Starting a use schedules its reminders; ending it
  cancels them. Identifiers are keyed by use `client_id`.
- Permission is requested on the first **Put in now**, with one line saying
  why. Declined: the Today card still counts down and says reminders are off,
  with a link to Settings.
- Notification text names the product type only, never a symptom or flow:
  "Time to change your tampon. It has been 8 hours." Nothing is sent through
  a server.
- On app start, open uses are reconciled with scheduled notifications, so a
  reinstall or a changed time zone does not leave stale or missing reminders.

---

## Testing

- Unit tests (node test, existing style) for: category readers and the
  grouped recognised line; product vocabulary; open use invariants; timer
  stages at each boundary; every safety rule including the heavy bleeding
  count; clinician summary wording, including the "no log says nothing" rule;
  no dashes in any produced copy.
- `lib/reminders.ts` tested against a fake scheduler: schedule on start,
  cancel on end, reconcile on start up.
- SQL test for `product_uses` RLS and the one open use index, alongside the
  existing `supabase/tests`.

## Out of scope

- Reading attachment contents, purchase or inventory tracking, product
  brand recommendations, and any server sent notification.
