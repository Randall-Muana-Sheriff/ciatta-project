# Condition focus: endometriosis forward, whole body underneath

Date: 2026-10-15
App: `ciatta-mobile-app` (Expo 57, React Native, Supabase)
Status: design approved in conversation, awaiting spec review

## Goal

Ciatta leads with endometriosis and related conditions, so it is clear
who it is for. A person managing one of them is welcomed by it in
onboarding, and sees Today through it: a quick check in, where they are
in their cycle, their own flare patterns, and one next step.

Underneath, the whole body engine keeps reading everything Ciatta has:
- Apple Health
- hospital records
- labs and documents
- environment
- the calendar

It powers those condition features through one bridge, so the condition
screens stay clean. Everyone without a condition focus keeps today's whole
body Ciatta unchanged.

## Decisions taken in conversation

1. **Endometriosis plus related conditions.**
   - Endometriosis leads.
   - Adenomyosis, PCOS, chronic pelvic pain and heavy periods follow the same pattern.
   - Each condition is a configuration, not a new set of screens.
2. **Home is Today, seen through the condition.** There is no new tab.
3. **Flare risk:**
   - Her own patterns come first, shown once she has logged at least 3 flares.
   - A daily level (low, medium, high) appears only once her history shows the signals came before her flares at least 3 of the last 5 times.
4. **Proactive notifications:**
   - visit prep before appointments
   - new results arrived
   - a daily check in
   - no flare heads up
5. **All three parts are built:**
   - 1, condition focus and onboarding
   - 2, Today through the condition
   - 3, the bridge and the background engine

## What exists today (and is reused)

- **Onboarding** (`OnboardingScreen`, `lib/onboarding.ts`): intents, age range, life stage, cycle, goals, kept in `profiles.onboarding`.
- **Logging** episodes carry:
  - `kinds` (including Pain)
  - `locations` (body map)
  - `severity` 0 to 10
  - `symptoms`
  - `flare_up_user_reported`
  - bowel fields
- **Cycle:** `cycleModel`, `cycleLens`, `cyclePatterns`.
- **The agent:**
  - context: `lib/agent/proactive.ts` `AgentContext`
  - tasks: `lib/agent/tasks.ts` `visitPrep`
  - recommendations and threads
- **Server push:** `intelligence/push.ts`. The lock screen never says what a finding is about.
- **Device:**
  - calendar on the phone: `state/deviceCalendar.ts`
  - local notifications: `state/notifications.ts`
- **Daily data:**
  - wearables: `daily_metrics`, `observations`, `baselines`
  - labs: `results`
  - environment: `environment_days`
  - food: `meals`

## Global constraints

The same as earlier specs:
- Expo 57 docs.
- No em dash, en dash or hyphen in UI copy, and `displayCopy()` on remote text.
- Jost, on Ground.
- Health data is never logged.
- Runs as her under RLS.
- Absence is never normal.

Copy and claims:
- Public copy is gender neutral. In the app it speaks to her condition.
- Nothing is inferred from absence, and nothing is diagnosed. Patterns name the signals and days behind them.
- Lock screen text never names a condition, result or symptom.

---

## Part 1: Condition focus and onboarding

### The focus

- `profiles.onboarding.focus = { condition, status }`
  - `condition`: one of `endometriosis`, `adenomyosis`, `pcos`, `pelvic_pain`, `heavy_periods`
  - `status`: `diagnosed` or `suspected`
- Absent means no focus: the whole body Ciatta as today.
- It can be set or cleared in Profile, under a new "Your focus" row.

### Onboarding

The first screen asks "What brings you to Ciatta?":
- **Endometriosis** comes first, larger, with a line beneath it.
- Then Adenomyosis, PCOS, Chronic pelvic pain, Heavy periods.
- Then "Something else", which continues to today's intents screen.

Choosing a condition:
- asks "Diagnosed or suspected?"
- then continues to the existing age, life stage and cycle questions
- skips the general intents screen

Choosing a condition also:
- adds it to her conditions list when diagnosed
- marks the intent `managing_condition`, so the agent and copy behave as they do now for that intent

### Condition configuration (`lib/conditions.ts`, pure)

```
type ConditionConfig = {
  key, label, shortLabel,
  checkIn: CheckInField[]        // what the daily check in asks
  symptoms: string[]             // the condition's symptom chips
  relevantLabs: string[]         // testKeys (labs.ts) worth showing
  precursorSignals: Signal[]     // which signals flare patterns consider
  visitQuestions: string[]       // seeds for visit prep
}
```

**Endometriosis, in full:**
- **Check in:**
  - pain 0 to 10
  - where (body map regions)
  - bleeding (none, spotting, light, medium, heavy)
  - bowel pain
  - bladder pain
  - pain with sex
  - fatigue
- **Labs:** ferritin, hemoglobin, CA 125, vitamin D, CRP.
- **Signals:**
  - sleep hours
  - HRV
  - resting heart rate
  - cycle day and phase
  - stress or mood
  - steps
  - logged foods (dairy, gluten, alcohol, caffeine) where she logs them
  - weather (pressure change, temperature)

**The others** start with check in, symptoms and labs adapted from the endometriosis config:
- PCOS: androgens, insulin, glucose, A1c, lipids.
- Heavy periods: ferritin, hemoglobin, iron.

Each label and line is reviewed for claims. A config never says what causes the condition.

---

## Part 2: Today, through the condition

For a person with a focus, the top of Today becomes four cards. The rest of today's Today follows below, unchanged.

1. **Check in.**
   - The condition's check in fields, one tap each. It is saved as an episode: Pain when pain is above 0, with locations, severity and symptoms.
   - Once she has logged today, it shows her entry with "Edit".
   - "This is a flare" is a toggle (`flare_up_user_reported`).
2. **Your cycle.**
   - Cycle day and phase (`cycleToday`, the observational phase, and the estimated phase as "likely").
   - One line on what usually happens for her at this point in her cycle, from `cyclePatterns`, shown only when her history supports it. For example: "Pain has been higher on days 25 to 28 in 3 of your last 4 cycles."
3. **Your flare patterns** (Part 3's bridge).
   - Under 3 flares: "Ciatta is learning your flares. Mark a check in as a flare when it is one." It names how many she has logged.
   - From 3 flares: up to three pattern lines, each naming its signals and days. For example: "Your last 3 flares followed 2 nights under 6 hours of sleep."
   - Once earned: a daily level with the reasons beneath it. For example: "Medium today: day 25 and 5.5 hours of sleep last night."
4. **One next step.** The agent's top current recommendation for her focus (the existing recommendations, filtered by condition relevance), with its source.

The whole body content (vitals, insights, the rest) stays below, under a heading "Your whole body".

---

## Part 3: The bridge and the background engine

### The bridge (`lib/conditionSignals.ts`, pure)

It takes `(config, AgentContext, episodes, now)` and returns:

```
{
  checkInToday: Episode | null,
  cycle: { day, phase, likely, usualLine: string | null } | null,
  flares: { count, patterns: FlarePattern[], level: FlareLevel | null, learning: boolean },
  labs: { name, latest: LabResult, status }[],     // config.relevantLabs that she has
  nextStep: Recommendation | null,
}
```

**Flare patterns:**
- For each precursor signal, compare the 3 days before each logged flare with her baseline days, meaning non flare days outside those windows.
- A pattern is reported when the signal was outside her usual range (`baselines`) before at least 3 flares, or in at least 60% of flares when she has 5 or more.
- Each pattern carries its signal, direction, window, and the count it was true for. It is worded only from those facts.

**Earned level:**
- Replay her last 5 flares: would today's rule have flagged the 3 days before each?
- When it was right at least 3 of 5 times, and flagged no more than half of her non flare days, the daily level is shown.
- Low means no precursors present, medium means one, high means two or more.
- The level always lists which precursors are present.

Condition screens only call the bridge. They never read the engine's tables themselves.

### Background engine: sources and gaps

- **Check that every source reaches `AgentContext`** and the server engine:
  - Apple Health metrics
  - provider records and labs
  - document filings
  - environment days
  - meals
  - calendar events (on the phone only)
- Fill any that do not reach it: provider labs and document filings are new since the context was built.
- The intelligence run (server) treats a focus condition's relevant labs and symptoms as higher priority when choosing what to surface.

### Notifications

- **Daily check in** (local, on the phone):
  - at a time she picks in Profile, Notifications ("Daily check in", off by default, then on during onboarding when she chooses a focus)
  - skipped when she has already logged that day
  - lock screen: "Time for your check in."
- **Visit prep** (local, on the phone, from the calendar on the phone):
  - for each event in the next 36 hours that looks medical (a title or location matching her providers, her care team, or medical words such as clinic, doctor, Dr, appointment, OB, GYN, hospital), a notification the evening before at 6pm, or 2 hours before if it is sooner
  - lock screen: "You have an appointment tomorrow. Your visit summary is ready."
  - opens visit prep, the existing `visitPrep` with the focus condition's `visitQuestions` added
- **New results** (server push, the existing push path):
  - sent when a provider sync writes new records or labs, or a lab or document analysis is stored
  - lock screen: "New results are in. Open Ciatta to see them." Never what they are.
  - opening it shows urgent items first
  - respects a "New results" setting, on by default, beside New Findings

---

## Testing

- **Pure, under `npm test`:**
  - `conditions.ts` configs: every check in field maps to an episode field, and labs are testKeys
  - onboarding flow order with and without a focus
  - `conditionSignals`: learning state, patterns at 3 flares and at 60% of 5, earned level replay (earned at 3 of 5, not at 2 of 5, refused when it flags more than half of non flare days), and level reasons
  - Today card selection
  - notification planning: which events count as medical, the evening before or 2 hours before, a check in skipped when already logged
  - push copy never naming a condition or result
- **SQL:** the new results push trigger or queue is owner scoped. Notification settings live in profiles.
- **Device:** onboarding with Endometriosis, a check in, flare marking, and a visit prep notification from a test calendar event.

## Out of scope

- Flare heads up notifications (declined).
- Clinician facing dashboards.
- Conditions beyond the five listed.
- Changing the whole body experience for people with no focus.

## Risks

- **Patterns read as predictions.** They are worded as what came before her past flares, never as what will happen. The level appears only once earned, and always shows its reasons.
- **Small numbers.** With 3 flares a pattern can be chance. The line says how many flares it is based on.
- **Calendar matching may miss or over match appointments.** She can turn visit prep off, and a non medical match only costs one notification.
