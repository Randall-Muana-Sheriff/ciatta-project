# Cycle situations and bowel movement logging

Date: 2026-09-15
App: `ciatta-mobile-app` (Expo 57, React Native)
Status: design approved, awaiting spec review

## Goal

Cycle tracking must work for people whose cycles are not regular: endometriosis,
PCOS / PMOS, postpartum, perimenopause, hormonal contraception, irregular cycles,
and no periods right now. Each person sees a Cycle experience that clearly reflects
their situation. Bowel movements become their own loggable type.

## Constraints

- Keep Jost and the existing design. New UI reuses `chrome.tsx` and `kit.tsx`
  components (Panel, ListGroup, ListRow, SegmentedControl, Tag, PrimaryButton).
- UI copy has no em dash, en dash or hyphen, and passes through `displayCopy()`.
- The app never names a diagnosis or cause. Situations are what the user told us.
- No fertility or ovulation predictions are ever shown.
- Existing saved data (`ciatta.cycle.v1`) must still load.

## 1. Cycle profile

### Data

```ts
type Situation =
  | 'Regular' | 'Irregular' | 'Endometriosis' | 'PCOS / PMOS'
  | 'Postpartum' | 'Perimenopause' | 'Hormonal contraception' | 'No periods right now';

type CycleProfile = {
  situations: Situation[];          // any combination, may be empty until setup
  birthDate?: string;               // ISO day, Postpartum
  breastfeeding?: boolean;          // Postpartum
  lastPeriod?: string;              // ISO day, Perimenopause (used when no period is logged)
  contraception?: 'Pill' | 'Hormonal IUD' | 'Implant' | 'Injection' | 'Ring or patch' | 'Other';
  setupDone: boolean;
};
```

Stored in the cycle store alongside episodes under the same AsyncStorage key. A
saved object without `profile` loads with the sample profile
(`situations: ['Endometriosis', 'Irregular']`, `setupDone: true`) so existing
installs keep working.

Selection rules:
- `Regular` and `Irregular` are mutually exclusive; picking one clears the other.
- `No periods right now` clears `Regular` and `Irregular`.
- All other situations combine freely.

### Screen: `CycleProfileScreen` (new, registered as screen `cycleProfile`)

- Title "Your Cycle", subtitle "Pick everything that fits. You can change this any time."
- One ListGroup of selectable rows, one per situation, each with a one line
  description (for example Postpartum: "You gave birth in the last year or so").
- Follow ups appear inline under a selected row: birth date and breastfeeding
  toggle (Postpartum), last period date (Perimenopause), contraception type
  (Hormonal contraception). Dates use the same day picker pattern as CycleLog.
- PrimaryButton "Save". Saving sets `setupDone: true`.
- Reached from: first open of Cycle when `setupDone` is false, a "Your Cycle"
  row in Profile, and the situation tags on the Cycle header.

## 2. Adaptive cycle model

Replaces `TYPICAL_LENGTH`, `PAST_LENGTHS` and the fixed `cycleStartDates()`.

- `cycleStartDates(episodes, profile, now)` returns the start day of every logged
  episode whose kinds include `Period`, deduplicated so starts less than 10 days
  apart count once. Spotting, postpartum bleeding and withdrawal or breakthrough
  bleeds never start a cycle.
- `CycleWindow` keeps its shape. The last window is open (`end: null`).
- `regularity(windows)` returns `'predictable'` when there are at least 3
  completed cycles and max length minus min length is 7 days or less; otherwise
  `'unpredictable'`. Situations `Irregular`, `PCOS / PMOS`, `Perimenopause`,
  `Postpartum` (until 3 periods have returned since `birthDate`) and
  `No periods right now` force `'unpredictable'`. `Hormonal contraception` never
  uses ovulation related wording.
- `phaseOf()` returns `null` when unpredictable. Predictable windows use the
  median past length for the open window instead of 27.
- Every signal gains `daysSincePeriod: number | null`. When phase is null,
  patterns group by days since the last period in bands: 0 to 7, 8 to 21,
  22 to 35, over 35.
- Sample data: `sampleEpisodes` gains logged `Period` episodes for six cycles of
  lengths 31, 44, 29, 52, 33 and the current one, matching the
  Endometriosis plus Irregular sample profile. `daily.ts` stays unchanged.

Consumers updated to the new signature: `cyclePatterns.ts`, `engine.ts`,
`cycleStore.tsx` (`useCycleInsights`), `JourneyScreen`, `HealthDashboard`,
`bodyMap.ts`, `CycleScreen`, `CycleHistoryScreen`.

## 3. Situation lenses

`src/lib/cycleLens.ts` (new) exports `lensFor(profile, windows, now)` returning:

```ts
type Lens = {
  header: { value: string; label: string; secondary?: { value: string; label: string } };
  headerChart: 'none' | 'lengthDots' | 'postpartumTimeline' | 'monthsSince';
  extraSymptoms: string[];          // added to the Symptoms step, deduplicated
  extraPainContexts: string[];      // added to the Pain step
  bleedingWords: { period: string; other?: string }; // e.g. Withdrawal bleed
  predicts: boolean;
  notes: string[];                  // short situation lines shown under the header
};
```

Lenses merge in this priority for the header: Postpartum, Perimenopause,
No periods right now, Irregular or PCOS / PMOS, Regular. Extra fields from every
selected situation are unioned.

| Situation | Header | Header chart | Extra logging | Patterns |
|---|---|---|---|---|
| Regular | Day X of cycle; recent range | none | none | existing phase patterns |
| Irregular | Day X since your last period; longest gap | lengthDots | Spotting between periods (existing kind) | gaps over 35 days; length variation |
| PCOS / PMOS | as Irregular | lengthDots | Acne, Hair growth, Hair loss, Ovulation signs | long gaps; skin and hair symptom counts per cycle |
| Endometriosis | adds Pain days in and outside your period | none | Pain with bowel movements, Pain when urinating, Pain during sex (pain contexts) | pain outside period days; bowel pain by phase or band; flare ups |
| Postpartum | Week N since birth; then Periods back: N | postpartumTimeline | Postpartum bleeding (bleeding word), Mood check (symptom); breastfeeding is a profile answer, not a log field | no predictions until 3 periods |
| Perimenopause | N months since your last period; note that 12 months marks menopause | monthsSince | Hot flashes, Night sweats, Brain fog, Joint pain | skipped periods; hot flashes against sleep |
| Hormonal contraception | Bleeds called Withdrawal bleed or Breakthrough bleeding | none | Missed pill (only for Pill) | no ovulation wording |
| No periods right now | Symptoms this month | none | none | symptoms by month |

`lengthDots` draws one dot per completed cycle length on a hairline scale
(reusing `lineCharts.tsx` style), with a dashed line at the median.
`postpartumTimeline` draws weeks since birth with markers at returned periods.
`monthsSince` draws a 12 step scale with the current month highlighted.

### Safety prompts

Shown as a Panel on the review step of the log only when triggered:
- Flow `Very heavy`: "Soaking through a pad or tampon in about an hour is worth a
  call to a clinician today."
- Postpartum and flow `Heavy` or `Very heavy`: "Heavy bleeding after birth needs
  urgent care. Call your clinician or emergency services now."
- Bowel movement with blood: "Blood in your stool is worth telling a clinician
  about soon."

## 4. Bowel movement log

- `WHAT_HAPPENED` gains `'Bowel movement'`.
- `EpisodeForm` gains:
  ```ts
  stool: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null;
  bowelPain: 'None' | 'During' | 'After' | 'During and after' | null;
  bowelFlags: ('Blood' | 'Urgency' | 'Straining' | 'Felt incomplete')[];
  ```
- New CycleLog step "Bowel movement", shown when the kind is selected: a
  7 option picker with small line pictures (new `StoolIcon` in `icons.tsx`) and
  words: Hard lumps, Lumpy, Cracked, Smooth, Soft pieces, Mushy, Watery. Then
  pain and flag chips.
- `episodeTitle` returns "Bowel movement" when it is the only kind;
  `summarize` adds a Bowel movement section.
- Body map: a bowel movement with pain adds a Rose point at `lower_abdomen`.
- History and Journey list it like other episodes; Journey month detail counts
  bowel movements with pain.
- Pattern: when at least 3 bowel movements with pain exist, an observation
  compares their share by phase (or by days since period band).

## 5. Error handling and edge cases

- No logged periods: windows are empty; the header falls back to the profile
  (`lastPeriod` for Perimenopause, `birthDate` for Postpartum) or to
  "No period logged yet" with a LinkButton "Log a Period".
- Profile empty: Cycle opens the profile screen once; Today and Journey still
  render using the unpredictable model.
- Dates in the future are rejected by the pickers.

## 6. Testing

- `npx tsc --noEmit` clean.
- A node check script (scratchpad, not committed) prints windows, regularity,
  lens header and extra fields for each single situation and for
  Endometriosis plus Perimenopause.
- Simulator screenshots of the Cycle header for every situation (switching the
  sample profile temporarily), the profile screen, the bowel movement step and
  each safety prompt. Defaults restored afterwards.

## Out of scope

- Fertility, ovulation prediction or pregnancy tracking.
- Any server sync; everything stays on device as today.
