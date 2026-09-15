# Capture and passive data (logging spec 1)

Date: 2026-09-15
App: `ciatta-mobile-app` (Expo 57, React Native)
Status: design approved, awaiting spec review

## Goal

Logging means "tell us what happened". Devices and records supply the
measurable; the person supplies lived experience in their own words or with a
tap; the app structures it and asks at most two short questions. The app never
asks for anything another source already knows.

Principle: ask for meaning, not measurements.

## Scope

This is spec 1 of the logging work:

1. **Universal capture** (this spec)
2. Voice capture (later spec)
3. **Passive data first** (this spec)
4. Personal vocabulary (later spec)
5. Proactive prompts (later spec)
6. Outcome loop: action, then what happened next (later spec; this spec stores
   the actions it needs)
7. Photo capture (later spec)

## Constraints

- Keep Jost and the existing design components (`chrome.tsx`, `kit.tsx`,
  `cycleInputs.tsx`). Text styles only through `font()`.
- **No product name in any copy.** The capture sheet says "What happened?" and
  confirms with "Saved".
- UI copy has no em dash, en dash or hyphen and passes through `displayCopy()`.
- Never phrase anything as a diagnosis. Extracted items are labels from the
  app's own lists.
- Never require daily logging; no streaks, no reminders to log.
- Tap targets at least 44 pt. Every chip and control has a VoiceOver label.
- Depends on the cycle situations plan
  (`docs/superpowers/plans/2026-09-15-cycle-situations.md`) Tasks 1 to 9,
  11 to 13 for the model, bowel fields, lens and temperature. That plan's
  Task 10 is replaced by this spec (see "Cycle plan changes").

## 1. Entry points

One action, the same everywhere: a `+` toolbar button labelled
"What happened?" for VoiceOver.

| Where | Before | After |
|---|---|---|
| Today header | none | `+` |
| Today list | "Log Cycle Experience", "Add a Note" rows, pain shortcut | one row "What happened?" opening the sheet |
| Health header | `+` with action sheet | `+` opens the sheet directly |
| Journey header | "Log Cycle Experience" button | `+` in header; button removed |
| Cycle screen | "Log Cycle Experience" button | "What happened?" button opens the sheet |
| Symptoms | inert "Log a Symptom" | opens the sheet with Symptoms tapped |
| Body map "Log Something Here" | detailed form | sheet opened with Pain and that place already chosen |

The detailed form (`CycleLogScreen`) remains, reached only from "Add detail".

## 2. The capture sheet

A modal sheet (`CaptureSheet`, React Native `Modal` with
`presentationStyle="pageSheet"`), title "What happened?", with:

1. **Text box**, multiline, placeholder
   "Cramps were bad this morning, I took ibuprofen".
2. **Repeat prompt**, when `similarTemplate()` returns a usual episode and its
   last occurrence was within the last 60 days: "Pain again?" with
   "Same as last time" and "Something changed".
3. **Quick taps**, multi select chips: Pain, Fatigue, Headache, Bloating,
   Mood, Brain fog, Night sweats, Bleeding changed, Period started,
   Bowel movement, Something else.
4. **Already known** strip (see section 6), one line per item, footnote style,
   under the label "Already known today".
5. Footer: PrimaryButton "Save", disabled until there is text or a tap.

## 3. After saving

1. The event is saved immediately (the person can close the sheet at any
   point after this and nothing is lost).
2. The sheet shows a **Saved card**: "Saved" plus one removable chip per
   extracted item (for example Pain · Cramping · Morning · Took ibuprofen),
   and the time it applies to ("This morning", "Yesterday", "This week").
   Removing a chip updates the saved event.
3. Then **at most two follow up questions**, chosen by `nextQuestion()`:

   | Order | When | Question | Options |
   |---|---|---|---|
   | 1 | Bowel movement and no stool type | "What did it look like?" | the 7 stool pictures |
   | 2 | Pain and no location | "Where did you feel it?" | Pelvis · Lower abdomen · Back · Hip · Other |
   | 3 | Pain or Fatigue and no impact | "How much did it affect your day?" | Manageable · Disruptive · Couldn't function |
   | 4 | Period started and no flow | "How heavy is it?" | Light · Moderate · Heavy · Very heavy |

   Each question has "Skip". After two questions, or when nothing qualifies,
   no more questions are asked.
4. Footer: "Anything else?" with SecondaryButton "Add detail" (opens the
   detailed form prefilled from the event) and PrimaryButton "Done".
5. Safety notes from `safetyNotes()` (cycle plan Task 5) appear on the Saved
   card when triggered.

Severity is never asked as a number. When the words state intensity
("really bad", "mild"), the extractor records `intensityWords` as the
person's own words; no number is invented.

## 4. Same as last time

- "Same as last time" saves the usual episode (`similarTemplate()`) dated
  today, `similar: true`, and shows the Saved card with no follow ups.
- "Something changed" asks "What changed?" with Location · Severity ·
  Sensation · Timing · Impact · Something else, then one question for the
  chosen field (location chips, the 0 to 10 scale, sensation chips, the time
  steppers, impact chips, or the text box), then saves.

## 5. What an event holds

```ts
type CaptureMethod = 'ai' | 'device' | 'tap' | 'same';

type Extracted = {
  happened: string[];      // HAPPENED labels
  locations: string[];     // LOCATION_GROUPS items
  sensations: string[];    // SENSATIONS
  when: { dayOffset: number; timeOfDay: 'Morning' | 'Afternoon' | 'Evening' | 'Night' | null; span: 'Moment' | 'Day' | 'Week' };
  intensityWords: string | null; // quoted from the text, never invented
  impact: 'Manageable' | 'Disruptive' | "Couldn't function" | null;
  around: string[];        // AROUND labels
  did: { action: string; detail: string | null }[]; // DID labels, e.g. Took medication, Ibuprofen
  flow: string | null;
  stool: number | null;
};

type CaptureEvent = {
  id: string;
  createdAt: string;       // ISO time
  text: string;            // the person's words, verbatim, may be empty
  taps: string[];
  method: CaptureMethod;
  extracted: Extracted;
  followUps: { question: string; answer: string | null }[];
  episodeId: string;       // the Episode derived from it
};
```

Vocabularies (`src/lib/capture/vocab.ts`):

- `HAPPENED`: Pain, Fatigue, Headache, Night sweats, Bloating,
  Digestive change, Mood, Brain fog, Bleeding changed, Period started,
  Bowel movement, Something unusual.
- `AROUND`: Stress, Travel, Illness, Poor sleep, Medication change,
  Supplement change, Diet change, Exercise, Sex, Major life event.
- `DID`: Took medication, Started supplement, Stopped supplement, Rested,
  Exercised, Changed diet, Tried treatment, Changed routine.

`toEpisode(event)` produces an `Episode` so every existing reader works:
Pain → kind Pain; Period started → kind Period with `periodStart`; Bleeding
changed → kind Spotting and change "Bleeding changed"; Bowel movement → kind
Bowel movement with `stool`; other HAPPENED items → kind Symptoms with the
matching SYMPTOMS labels (Night sweats and Brain fog join SYMPTOMS);
`around` → `context`; `did` → `helped` (Took medication → Medication,
Rested → Rest, Exercised → Movement, Tried treatment → Treatment);
impact → `affect`; text → `note`. Events are stored in the cycle store under
`captures` in the same AsyncStorage record; their episodes are added to
`episodes` with ids `cap-<id>`.

## 6. Passive data first

`alreadyKnown(days, medications, lens, now)` in `src/lib/known.ts` returns
items for today, each `{ label, value, change, source }`:

| Item | Value | Compared with |
|---|---|---|
| Sleep | last night, "6h 12m" | median of the same nights 35 to 90 days back; change shown when at least 30 min |
| Resting heart rate | "64 bpm" | same baseline; change when at least 3 bpm |
| HRV | "48 ms" | same baseline; change when at least 15 percent |
| Temperature | "+0.3 °C" | only when `tempDeviation` exists |
| Movement | "4,120 steps, 20 active min" | same baseline; change when at least 30 percent |
| Exercise | today's workouts, if any | none |
| Cycle | `lens.header` value and label | none |
| Medications | current names | none |

`change` is words, never a score: "58 min below your usual",
"above your usual". Items with no change still appear in the sheet with
value only.

**Nothing new to add.** Today shows the line "Nothing new to add. Your ring
and records are up to date." when `alreadyKnown` has no item with a change
and `buildInsights().today.lead` is null (the engine has nothing to surface).

The app never asks about anything `alreadyKnown` covers. Words about those
things in a capture ("slept badly") are still saved as lived experience.

## 7. Understanding words

`extract(text, taps)` in `src/lib/capture/extract.ts`:

1. If the AI switch is on and consent is given, call the Supabase edge
   function `extract-event` with a 4 second timeout.
2. On success, keep only labels present in the vocabularies (anything else is
   dropped) and quotes present in the text.
3. On any failure, use `extractOnDevice(text, taps)`
   (`src/lib/capture/device.ts`): extended word lists for HAPPENED, body
   places, sensations, time words (this morning, last night, all week),
   impact phrases ("couldn't work" → Couldn't function), medication names
   (from `medications` plus common over the counter names such as ibuprofen,
   paracetamol, naproxen), and the existing `readNote` cues for AROUND.
4. Taps are always merged in as HAPPENED labels.

The result records `method` so the Saved card can show "Understood on your
phone" when the fallback ran.

### Edge function `extract-event`

- Deno, in `supabase/functions/extract-event/index.ts`.
- Requires a valid user JWT (Supabase anonymous sign in); rejects others with
  401. Limit 60 calls per user per hour (table `capture_calls`,
  `user_id`, `created_at`), 429 beyond it.
- Calls the Claude Messages API with a single tool whose input schema is the
  `Extracted` shape with enum lists from the request, `tool_choice` forced to
  that tool, temperature 0. Model from secret `EXTRACT_MODEL`, default
  `claude-sonnet-5`; `claude-haiku-4-5-20251001` is the lower latency option
  if 4 seconds proves tight.
- System prompt: extract only what the text states; never infer a diagnosis
  or cause; leave fields empty rather than guess; quote intensity words
  exactly.
- Stores nothing: no text is logged or persisted; only the rate limit row.
- Secret `ANTHROPIC_API_KEY` set with `supabase secrets set`; never in the app.

### Consent and the switch

- First capture with text, before any call: a sheet "Understanding your
  words" explaining that the words are sent securely, processed by
  Anthropic's Claude, and not stored, with "Allow" and "Keep on my phone".
- Profile › Privacy and Data gains a switch "Understand my words with AI"
  reflecting and changing that choice.
- Off means everything uses the on device extractor.

## 8. Cycle plan changes

- Cycle plan Task 10 (bowel step and lens options in the detailed form) keeps
  only the detailed form parts reached from "Add detail". The bowel stool
  picker is reused as follow up 1 here; `lens.symptoms` and `lens.kinds`
  feed the quick taps (situation extras such as Hot flashes appear as quick
  taps when that situation is set).
- The cycle plan's entry point buttons ("Log Cycle Experience") are replaced
  by this spec's entry points.

## 9. Error handling

- Extraction failure never blocks saving; the device result is used.
- If extraction returns nothing, the event is saved with `happened:
  ['Something unusual']` and the text, and the Saved card offers the quick
  taps to label it.
- Offline: the call fails fast or hits the 4 second timeout and the device
  result is used. No network status library is added.
- The sheet can be closed at any moment after Save; unanswered follow ups are
  stored as `answer: null`.

## 10. Testing

- Unit tests (node:test via tsx): `extractOnDevice` on 15 example sentences
  (including the three in this spec), `nextQuestion` order and the two
  question cap, `toEpisode` mapping, vocabulary filtering of AI output,
  `alreadyKnown` changes and thresholds, Same as last time.
- Edge function: Deno test with a mocked Claude response and a rejected
  unauthenticated call.
- Simulator screenshots: sheet empty, sheet with repeat prompt, Saved card
  with chips, each follow up, consent sheet, Today with "Nothing new to add".

## Actions needing the user's go ahead

- Enabling anonymous sign ins on the live Supabase project.
- Setting `ANTHROPIC_API_KEY` (the user provides it) and deploying
  `extract-event`.
- Creating the `capture_calls` table on the live project.

## Out of scope

Voice, photo, personal vocabulary, proactive prompts, the outcome follow up,
live HealthKit reading (passive data uses the existing sample data through
`loadDays()`), and any daily check in.
