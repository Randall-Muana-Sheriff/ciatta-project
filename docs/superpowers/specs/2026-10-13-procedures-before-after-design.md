# Surgery and procedures: before and after

Date: 2026-10-13
App: `ciatta-mobile-app` (Expo 57, React Native)
Status: design approved in conversation, awaiting spec review

## Goal

A procedure is a line drawn through her record. What matters is what her
own measurements and symptoms did on either side of it, and that only
exists if the record runs through it. For each dated procedure, Ciatta
shows the six weeks before against the six weeks after, counted from her
logs and devices, and says when it cannot.

Reference layout (from the product brief):

> **Did the procedure change anything?**
> Your symptom days fell from 14 in the six weeks before to 5 in the six
> weeks after. Sleep returned to your usual in week 4.
>
> Laparoscopy · 12 Jan
> Before: 1 Dec to 11 Jan, symptom days 14
> Procedure: 12 Jan, Imported
> After: 13 Jan to 23 Feb, symptom days 5

## Constraints

- Keep Jost and the existing design; reuse `ui/kit.tsx`, `ui/chrome.tsx`.
- UI copy has no em dash, en dash or hyphen (date ranges read "1 Dec to
  11 Jan"), and passes through `displayCopy()`.
- Counted, never inferred: every figure comes from her rows. No claim that
  the procedure caused a change; the card states what happened on either
  side and says other things may have changed around then.
- A side with too little record says so instead of comparing.

## 1. Which procedures

- Imported: `clinical_records` with kind `procedure` and a date, from a
  connected provider. Labelled "Imported".
- Reported: she adds one from the Procedures section: a name and a date.
  New table `procedures` (`id`, `user_id`, `client_id`, `name`,
  `performed_on date`, `provenance` default REPORTED, timestamps, owner
  RLS, `unique (user_id, client_id)`). Labelled "You added".
- Undated surgeries from onboarding (`Reported.surgeries`) are listed with
  "Add the date to see before and after", which opens the add form with the
  name filled in.

## 2. The comparison (`lib/procedureEffect.ts`, pure)

`procedureEffect(input: { date: string; days: Day[]; episodes: Episode[]; journalSymptomDates: string[]; now: Date })`

- Windows: before is the 42 days ending the day before; after is the 42
  days starting the day after. The procedure day is in neither.
- Symptom day: a day with at least one episode whose kinds include Pain or
  Symptoms, or a journal entry of kind Symptoms.
- Coverage: a day is covered when it has any device reading or any log.
  A side needs at least 21 covered days, otherwise that side reads "Not
  enough of your record runs through this yet."
- After window not finished: shows weeks elapsed ("3 of 6 weeks after"),
  and no comparison sentence until all six weeks have passed.
- Return to usual, per measure (sleep, HRV, resting heart rate, steps):
  usual is `band()` over the 90 days before the procedure (at least 20
  values, or the measure is skipped). Week N after is the first week whose
  mean lies inside the band, reported as "Sleep returned to your usual in
  week 4". If it never does within six weeks: "Sleep had not returned to
  your usual by week 6". A measure whose first week after is already
  inside the band never left her usual, so it gets no line.
- Output: `{ before: Side; after: Side; sentence: string | null; measures:
  string[] }` where `Side = { from: string; to: string; symptomDays:
  number | null; covered: number; enough: boolean }`.
- Sentence: "Your symptom days fell from 14 in the six weeks before to 5 in
  the six weeks after." (rose, or "stayed at 6"), followed by the measure
  lines. A fixed closing line on the card: "Counted from your logs and
  devices. Other things may have changed around the same time."

## 3. Where she sees it

- Health → Records gains a **Procedures** section (in `ui/RecordsView.tsx`):
  imported and added procedures, newest first, each a row with name and
  date; undated surgeries below with the add prompt; an "Add a procedure"
  button.
- Tapping a procedure opens a new `procedure` screen: the question as the
  title, the sentence, then three stacked blocks as in the reference
  (Before, the procedure with its source tag, After), then the measure
  lines and the closing line.

## 4. Testing

- Unit: windows exclude the procedure day; symptom day counting (episodes
  and journal); coverage threshold per side; unfinished after window;
  return to usual week, never returned, measure skipped with thin usual;
  sentence for fell, rose, stayed; date ranges without dashes.
- SQL: `procedures` RLS (owner only).
- Repo: imported procedures read from `clinical_records`; reported ones
  from `procedures`.

## Out of scope

A Journey line for procedures, editing or deleting imported procedures,
comparing windows other than six weeks.
