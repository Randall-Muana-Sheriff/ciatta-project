# Lab reports: scan, read, visualise, and a clinical AI analysis

Date: 2026-10-14
App: `ciatta-mobile-app` (Expo 57, React Native, Supabase)
Status: design approved in conversation (three sections), awaiting spec review

## Goal

She has lab results as PDFs from her patient portal, and sometimes on
paper. Ciatta reads them, keeps each one as a report, shows it in four
visualisations drawn exactly from what the lab printed, and gives a full
clinical read of it from an AI model. That read covers what each result
means, what results mean together, which conditions are worth
considering, what to test next and what to ask. Every number it quotes is
checked against her record, and it is labelled as AI and as not a
diagnosis.

## What exists today (and stays)

- **Reading.** "Add a lab report" (`AddLabsScreen`, reached from Care and
  from the agent's suggestions) takes a camera photo, a library photo or a
  PDF. The `lab-scan` edge function sends it to OpenAI (`OPENAI_LAB_MODEL`,
  default `gpt-4o`), which copies out each test, value, unit, range and flag
  as printed. She checks and corrects every line before saving. The use is
  limited to 20 a day by `claim_lab_scan()`. The file is not stored.
- **Saving.** Each saved test becomes a row in `results` with
  `source = 'report'` (`20261014120000_labs.sql`). `results.document_id`
  already references `documents`, but nothing sets it.
- **Showing.** Records → Labs groups results by draw day (`labDraws`).
  `LabDetailScreen` charts one test over time with the lab's range shaded.
  `LabBriefScreen` builds a rule-based brief (result against range, trend,
  questions) and never interprets.
- **The AI pattern this follows.** `health-summary` gathers facts from her
  rows, gives the model only those facts, checks its answer against them,
  and discards an answer that fails, so unchecked model text never reaches
  her.

## Decisions taken in conversation

1. **Analysis depth: full clinical read.** It explains, finds patterns,
   names conditions worth considering with confidence, and suggests next
   tests. It never prescribes, doses, or tells her to start or stop a
   medication.
2. **Scanning: Apple's document camera** (VisionKit), with several pages in
   one session.
3. **Visualisations: all four.** Report at a glance, trends across reports,
   body systems map, cycle overlay.
4. **Three parts, built in order:** capture and reading, then
   visualisations, then AI analysis. AI approach A: one checked analysis
   per report, from a server function.
   Each part gets its own implementation plan and works on its own:
   Part 1 can ship before Parts 2 and 3 exist.
5. **Keep the original PDF**, privately, so any number can be checked
   against the source.
6. Her real PDFs are not used during design. Testing with them happens in
   the app.

## Global constraints

- Expo 57: read https://docs.expo.dev/versions/v57.0.0/ before writing Expo
  code.
- UI copy has no em dash, en dash or hyphen. Every remote or model string
  renders through `displayCopy()` (`src/lib/displayCopy.ts`).
- Keep Jost and the existing design. Every screen and sheet sits on Ground
  (`ui/Sheet`, `GroundLayer`) and is never a flat dark page. Reuse
  `ui/labs.tsx` (`LabRangeBar`, `LabStatusTag`), `ui/kit.tsx`,
  `ui/bento.tsx` and `ui/cardFill.tsx`.
- Public copy (store listing, Epic listing) never says women or her. In app
  copy addresses her as "you".
- Health data is never logged: counts and failure reasons only.
- Absence is never normal. A result with no printed range or flag is never
  shown or described as normal or in range.
- Every function runs as the caller (her JWT) under RLS. No service key on
  any path she can reach.

---

## Part 1: Capture and reading

### Entry

"Add a lab report" keeps its two entry points. It opens with three
choices:

- **Scan a paper report** opens the document camera.
- **Upload a PDF** opens the system file picker, PDF only.
- **Choose a photo** opens the photo library.

The current single camera photo option is replaced by the scanner.

### Document scanner

- A local Expo module, `modules/document-scanner`, wraps
  `VNDocumentCameraViewController`. It is local rather than a third party
  package, so Ciatta owns the roughly 80 lines of Swift and their
  behaviour. It exposes one call, `scanDocument(): Promise<{ pdfUri: string;
  pages: number } | null>`. `null` means she cancelled.
- The pages are written into one PDF in the app's cache. From there a scan
  and a portal PDF take exactly the same path.
- iOS only, like VisionKit. On a device where the scanner is unavailable,
  the option is hidden and the other two remain.
- This needs a new development build and a new store build. Nothing about
  it can ship by OTA.

### Reading

- `lab-scan` keeps its contract (base64 in, checked JSON out) and its
  copy, don't interpret rule. It gains these fields in the response:
  - `panel` per test: the panel heading the test is printed under, or null.
  - Per report: `collected_on`, `lab`, `ordering_clinician`, `specimen`.
  - `unreadable_pages`: page numbers it could not read.
- **Long PDFs.** The phone splits a PDF over 8 pages, or over the size limit,
  into chunks of up to 8 pages. Each chunk is read by its own call, and the
  phone merges the results. The merge keeps the first non null report
  fields and concatenates tests in page order. Each chunk counts against
  the daily limit, so a 24 page export uses 3 of 20.
- `readLabScan` in `src/lib/labs.ts` validates the new fields the way it
  validates the current ones. An unknown flag, a non string name or a
  non numeric value drops that line rather than passing it through.

### Checking

The existing review screen stays. Lines are grouped under their panel
headings, and lines with no panel go under "Other results". She can edit,
leave out or add a line. Nothing is saved until she confirms. If any
pages were unreadable, a line above the list names them: "Page 3 could not
be read. Check it against your report."

### Saving: the report

- One upload becomes one row in `documents`:
  - `doc_type = 'lab_report'`
  - `title` = the lab name, or "Lab report"
  - `occurred_at` = the collection date
  - `extraction_status = 'extracted'`
  - `metadata`: `{ lab, ordering_clinician, specimen, pages, panels: [...], checksum }`
- The original PDF goes to the private `documents` storage bucket at
  `<user_id>/lab-reports/<document_id>.pdf`. Storage policies scope every
  path to the owner, so check them and add them if missing.
- Each kept test becomes a `results` row with `source = 'report'`,
  `document_id` set, and `panel` set (the column exists).
- **Duplicates.** `checksum` is the SHA-256 of the PDF bytes. Uploading a
  file whose checksum matches one of her reports says "You added this
  report on 3 Mar" and offers to open it instead of reading it again.
- Saving is one RPC, `save_lab_report(...)`, so the document row and its
  results are written together or not at all. The upload to storage
  happens first. If the RPC then fails, the stored file is removed.

### Removing a report

The Report screen has "Remove this report". It deletes the document, its
results and its stored PDF, and its analysis (Part 3). Confirmation text:
"This report and the results read from it are removed from Ciatta. Your
records at your provider are not changed."

### Errors

- Not a lab report: "This does not look like a lab report. Nothing was
  saved."
- Model unavailable or over the daily limit: the existing messages.
- Nothing readable: "Ciatta could not read any results from this file.
  Nothing was saved."

---

## Part 2: Visualisations

All four are drawn by code from saved rows. None of them is drawn or
worded by the AI.

### Report at a glance (new `LabReportScreen`)

- It opens after a report is saved, and from each draw in Records → Labs. A
  provider draw with no document also opens it, built from that day's
  results.
- **Header:**
  - collection date, lab, and ordering clinician if printed
  - "View original" opens the stored PDF in the system viewer
  - a count line, "4 high, 2 low, 31 in range, 3 with no range given",
    from `labStatus`
- **One card per panel**, in the order printed. Out of range tests come
  first inside each card. Each test shows its value with unit,
  `LabStatusTag` and `LabRangeBar`. A test with no range shows "No range
  given" and no bar. Tapping a test opens `LabDetailScreen`.
- The Part 3 analysis sits below the panels. Its findings also show under
  the matching test in the panel card.

### Trends across reports

- `LabDetailScreen` gains a change line: "Up 18% since 3 Mar", or "No
  earlier result". It compares with her previous result for the same test
  in the same unit. If the units differ, it says "Earlier result in a
  different unit" and does not compare.
- Results from providers and from reports chart on one line, with points
  shaped by source and a legend.
- `LabReportScreen` gets a **Panel trends** section: one small chart per test
  in the panel, across all her reports, with the shared x axis as dates.
  It appears only for tests with at least two results.
- Test identity across sources: case and whitespace are folded, plus a small
  alias table (`labAliases` in `src/lib/labs.ts`) for common spellings,
  for example "Hemoglobin A1c" = "HbA1c" = "A1C". No fuzzy matching.

### Body systems map

- `labSystem(name): SystemLabel | null` in `src/lib/labSystems.ts` maps a
  test to one of Ciatta's ten systems through an explicit table. Tests not
  in the table return null.
  - Circulatory: CBC, iron studies, ferritin, B12, folate
  - Metabolic: glucose, A1c, insulin, lipids, thyroid (TSH, free T4,
    free T3, antibodies), vitamin D
  - Digestive: ALT, AST, ALP, bilirubin, albumin, GGT
  - Urinary: creatinine, BUN, eGFR, urinalysis
  - Reproductive: estradiol, progesterone, LH, FSH, prolactin,
    testosterone, SHBG, AMH, DHEA S
  - Immune: CRP, ESR, white cell differential, ANA
  - Musculoskeletal: CK, calcium, phosphate
- The existing body figure (`bodyMap.ts` `SYSTEM_DOTS`, `SYSTEM_PLACES`)
  lights each system the report touches. A system with an out of range
  result shows the attention mark. Tapping a system lists its results from
  this report. Unmapped tests are listed under Whole Body.

### Cycle overlay

- It applies to estradiol, progesterone, LH, FSH, prolactin and testosterone.
- `cycleDayAt(day, cycleStarts): { day: number; phase: Phase } | null` uses
  her logged period starts (`cycleModel`). It returns null when no period
  start lies within 45 days before the draw date, or when the draw date is
  before her first logged start.
- **Report screen:** a small cycle strip on each hormone test, marking the
  draw on the cycle day with the phase named.
- **LabDetailScreen:** for hormone tests, each point is labelled with its
  cycle day, so values from different phases are not read as a trend.
- **Phase ranges.** When the printed range text names phases
  ("Follicular 12.5 to 166 / Luteal 43.8 to 211"), `phaseRanges(text)`
  splits it. The range matching her phase at the draw is the one the bar
  uses, and it is named. If her phase is unknown, every printed range is
  shown and none is chosen.
- When it cannot be known: "Cycle day at this test is not known. Log your
  periods to see it."

---

## Part 3: Clinical AI analysis

### Flow

- After `save_lab_report` succeeds, the app calls `lab-analysis` with the
  document id. The Report screen shows "Analysing your report" until it
  returns.
- The analysis is stored. Opening the report later reads the stored
  analysis and makes no new call.
- If the report's facts change (a result edited, or a new earlier result
  arriving for the same tests), the stored analysis shows "Your results
  have changed since this was written", with "Analyze again".
- Limit: `claim_lab_analysis()`, 20 a day, checked before the model is
  called, in the same pattern as `claim_lab_scan`.

### Facts (gathered by the function, as her, under RLS)

- This report: each test's name, value, unit, printed range, flag and panel.
- Her earlier results for the same tests: up to 5 each, with dates.
- Cycle day and phase at the draw (null when unknown), and her typical
  cycle length.
- Age range, life stage and gender as she set them in her profile. There
  is no sex at birth field, and this design does not add one.
- Conditions: her own list, and conditions from connected providers.
- Medications and supplements she takes now.
- Symptoms logged in the 30 days before the draw: name and count only.

The facts are built by a pure `analysisFacts(...)`, with a stable order and a
`facts_hash` (SHA-256 of the canonical JSON). They are the only health
information sent to the model.

### Model

- `OPENAI_ANALYSIS_MODEL` (default `gpt-4o`), with structured output (JSON
  schema, strict).
- The system prompt states the role: a clinical laboratory consultant
  writing for the patient. It also states the rules: quote values exactly as
  given, use only the facts, no doses and no starting or stopping
  medication, urgent items first, and say what would confirm a condition
  rather than declaring it.

### Output schema

```
urgent:        [{ test, value, reason, action: 'contact_today' | 'urgent_care' }]
summary:       string (2 or 3 sentences)
findings:      [{ test, value, explanation, common_causes: string[], relevance: string | null }]
patterns:      [{ title, tests: string[], explanation }]
considerations:[{ condition, tests: string[], confidence: 'low' | 'moderate' | 'high', how_confirmed }]
next_tests:    [{ test, reason }]
questions:     string[]
```

### Checking (pure `checkAnalysis(analysis, facts)`, in the function's directory, unit tested from `src/`)

An analysis is rejected if any of these hold:

- A `test` or `tests[]` entry is not a test in the facts (after alias
  folding).
- A `value` does not equal that test's value in the facts, as printed with
  its unit.
- Any number in any free text field that matches neither a fact value, a
  fact range bound, a date nor a cycle day. Small integers 1 to 12 used as
  counts are allowed.
- Any text contains a dose pattern (a number followed by mg, mcg, IU, units
  or g per day or dose), or tells her to start, stop, increase or decrease
  a medication.
- `urgent` is empty while a fact carries flag `HH`, `LL` or `AA`.
- More than 12 findings, 8 patterns, 6 considerations, 8 next tests or 10
  questions (bounds keep it readable).

A rejected analysis is retried once with the rejection reasons added. If
the retry fails too, nothing is stored and the screen shows "The analysis
could not be checked, so it is not shown. Your results above are
unaffected." The urgent banner still appears from the lab's own critical
flags, because that banner is computed by code from the facts, not by
the model.

### Storage

New table `lab_analyses`:

- `id`, `user_id`, `document_id` (references `documents`, on delete
  cascade; null for a provider draw)
- `draw_day` (for a provider draw), `model`, `facts_hash`, `analysis jsonb`,
  `created_at`
- RLS select her own. There is no client insert or update: the function
  writes with her JWT through a security definer RPC,
  `store_lab_analysis(...)`, which checks ownership of the document.

### Display (on `LabReportScreen`)

- **Urgent banner** at the top, in attention colour, when present.
- A **Clinical AI analysis** section with:
  - summary
  - findings (also shown under each test in its panel card)
  - patterns
  - conditions to consider, each with a confidence chip and "How it is
    confirmed"
  - suggested next tests
  - questions
- The label, always visible at the top of the section: "Clinical AI
  analysis. Not a diagnosis. Discuss it with your clinician." Below it:
  "Written by <model> on <date> from the results above."
- **Share or print** reuses the lab brief's PDF output (`expo-print`),
  extended with the analysis.

### Privacy

The facts go to OpenAI, the same processor that already reads her lab
reports. Nothing is logged beyond counts, the model name and rejection
reasons. The Privacy screen's list of processors is checked so it states
this.

---

## Testing

- **Pure, under `npm test`:**
  - `readLabScan` with the new fields
  - the PDF chunk planner and merge
  - `labSystem`
  - `labAliases` folding
  - `cycleDayAt`
  - `phaseRanges`
  - change since last (same unit and different units)
  - `analysisFacts` and `facts_hash` stability
  - `checkAnalysis`: each rejection rule has a test that fails without the
    rule, plus a passing fixture
- **SQL (pgTAP):**
  - `save_lab_report` is atomic and owner scoped
  - removing a report cascades its results and analysis
  - `lab_analyses` RLS
  - `claim_lab_analysis` limit
  - storage policy scoping
  - grants allow list updated deliberately
- **Function, local:** `lab-analysis` against a fixture report with the
  model replaced by a canned response through an env flag that only works
  locally. This covers checking, retry and storage without calling OpenAI.
- **Device:**
  - scan a 3 page paper report
  - upload a multi page portal PDF
  - check grouping, every visualisation, the analysis, Remove, and the
    duplicate notice
  - the user's real PDFs are used here, by the user, in the app

## Out of scope

- Android scanning (VisionKit is iOS only; Android keeps photo and PDF).
- Reading reports in languages other than English.
- Editing the AI analysis, or chatting about it. The Care agent can link to
  the report.
- Any change to provider (FHIR) labs beyond showing them in the same views.
- A sex at birth profile field.

## Risks

- **Software that interprets results.** A full clinical read that names
  conditions is closer to medical device territory than anything Ciatta
  does today. The labelling, the no doses and no medication changes rule,
  and checked output are the mitigations. App Store review (guideline
  1.4.1) may ask how it was validated. Before the store release, get a
  regulatory opinion on whether the conditions to consider section needs
  clearance. The feature can ship with that section switched off by a
  server setting while that is answered.
- **Model misreading a PDF.** Mitigated by her line by line check before
  saving, and by "View original".
- **Cost.** Bounded by the two daily limits.
