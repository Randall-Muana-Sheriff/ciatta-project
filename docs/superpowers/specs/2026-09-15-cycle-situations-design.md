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
- Fertility and ovulation estimates always show their confidence in words and
  the line "This is an estimate, not birth control. Don't rely on it to
  prevent pregnancy." (see revision 10).
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
| PCOS / PMOS | as Irregular | lengthDots | Acne, Hair growth, Hair loss (fertility signs come from revision 10) | long gaps; skin and hair symptom counts per cycle |
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

## Revisions during planning

These override the sections above where they differ.

1. **Sample cycle lengths** are 34, 41, 30 and 26 days (five starts, the last
   being the current cycle). The earlier 31, 44, 29, 52, 33 reached 200 days
   back, past the 150 days of sample daily data. The last completed cycle is
   the shortest, which keeps Today's combined insight in the lead. The sample record also logs a
   Period at every cycle start and three painful bowel movements during
   periods.
2. **Completed cycles keep all four phases**, because their next start is a
   logged fact. Only an open cycle without a prediction loses phases after its
   first week (During period and After period still apply).
3. **Bleeding words are log kinds**, not relabels. Period always stays.
   Postpartum adds `Postpartum bleeding`; Hormonal contraception adds
   `Withdrawal bleed` and `Breakthrough bleeding`. All route to the dates and
   flow step; only Period starts a cycle. The Lens exposes `kinds`, `symptoms`
   and `contexts` lists instead of `bleedingWords`.
4. **Postpartum symptoms** are `Low mood` and `Anxious or on edge` instead of
   a "Mood check" chip.
5. **Setup is offered, not forced**: when `setupDone` is false, Cycle shows a
   "Tell us about your cycle" panel with a button, rather than opening the
   profile screen automatically.
6. **Picking Regular or Irregular** also clears `No periods right now`.
7. **Stored sample episodes are rebuilt on load**; only the person's own
   episodes (ids not starting with `sample-`) come from storage, passed
   through `normalizeEpisode`. The store holds and saves only the person's
   own episodes, and the sample record steps aside once they include a
   Period of their own.
8. **Bowel fields** are typed `stool: number | null`, `bowelPain: string | null`,
   `bowelFlags: string[]`, matching the rest of the form.
9. **Tests** run with `node:test` through `tsx` (`npm test`), covering
   `cycleProfile`, `cycleModel`, `cycleLog`, `cyclePatterns` and `cycleLens`.
10. **Fertility and ovulation prediction is in scope** (approved 2026-09-15).
    `src/lib/fertility.ts` estimates, for the current cycle:
    - **Calendar:** ovulation is the luteal length (default 14 days) before
      the next start. Predictable cycles use the median length and give an
      ovulation window of that day plus or minus 1. Unpredictable cycles use
      the shortest and longest recent lengths (21 and 35 when none), giving a
      wide window. The fertile window is 5 days before the ovulation window
      through 1 day after.
    - **Temperature:** `Day` gains `tempDeviation` (nightly °C change, Oura).
      Three nights in a row at least 0.2 °C above the average of the six
      nights before confirm ovulation on the day before the rise. This only
      confirms, never predicts. Sample data rises 12 days before each start.
    - **Logged signs:** Positive ovulation test, Egg white discharge and
      Ovulation pain join the Symptoms options whenever fertility is on. A
      positive test puts ovulation 1 to 2 days later.
    - **Learning:** the median gap from temperature confirmed ovulation to the
      next start (kept between 9 and 17) replaces 14.
    - **Confidence:** Higher (confirmed this cycle, a positive test, or steady
      cycles with 2 or more past confirmations), Medium (steady, calendar
      only), Low (irregular or no full cycles).
    - **By situation:** Hormonal contraception and No periods right now hide
      it with a reason. Postpartum shows only temperature or test signs until
      2 periods have returned, with a note that fertility can return before
      the first period. PCOS / PMOS adds a note that tests can read positive
      without ovulation. Irregular and Perimenopause get the wide Low window.
    - **Screens:** a Fertile window panel on Cycle with a strip (period days,
      fertile window outline, ovulation days, today; filled when confirmed),
      the dates, the confidence line, notes and the disclaimer. Journey month
      detail gains an Ovulation row. Your Cycle gains a "Show Fertile Window"
      switch, on by default (`CycleProfile.showFertility`, undefined means on).
    - PCOS / PMOS no longer adds an "Ovulation signs" chip; the fertility
      signs replace it.

## Out of scope

- Pregnancy tracking, and any use of the fertile window as contraception.
- Any server sync; everything stays on device as today.
