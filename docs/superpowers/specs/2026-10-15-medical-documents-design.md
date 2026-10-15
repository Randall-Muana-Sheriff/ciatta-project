# Medical documents: read, file, explain and analyse any document

Date: 2026-10-15
App: `ciatta-mobile-app` (Expo 57, React Native, Supabase)
Status: design approved in conversation, awaiting spec review
Builds on: `2026-10-14-lab-reports-and-clinical-analysis-design.md`
(capture, chunked reading, reports kept with their original, checked
analysis)

## Goal

She uploads a PDF or scans paper, and Ciatta reads any medical document,
not only lab reports. It works out what kind of document it is, copies out
what it says, files each item where the app already keeps it once she has
checked it, keeps the original, and writes two things: a plain language
explanation, and a full clinical read across her whole record. Both are
checked against the document and her record, and both are labelled as not
a diagnosis.

## What exists today

- **Lab reports** (Parts 1 to 3 of the lab design):
  - scan, PDF or photo, read by `lab-scan`, checked by her, saved by
    `save_lab_report`, original in the `documents` bucket
  - `LabReportScreen`
  - the checked `lab-analysis`
- **"Add to Your Records"** (`AddRecordScreen`) keeps a note with files on
  the phone. Its own comment says "Nothing is read off a page".
- **Where things are filed today:**
  - `conditions` (kind `condition` | `surgery` | `symptom`, status, provenance)
  - `medications` (name, dose, started_on, stopped_on, metadata, provenance)
  - `procedures` (name, performed_on, client_id, provenance)
  - `referrals` (specialty, clinician, reason, referred_by, referred_on, steps, notes, client_id)
  - `profiles.insurance` (provider, plan, member_id)
  - `results` (labs)
- `documents` holds `doc_type`, `metadata`, `storage_path`, and
  `provenance` defaulting to `DOCUMENT`.

## Decisions taken in conversation

1. **Every document type, sorted automatically:**
   - lab report
   - visit summary, clinic note or discharge papers
   - imaging report
   - pathology report
   - prescription, pharmacy printout or medication list
   - referral letter
   - insurance card
   - anything else
2. **After reading:** everything found is filed into her record once she
   has checked it.
3. **Explanation and full clinical read for every non lab type.** Lab
   reports keep their existing analysis.
4. **Built in two parts:**
   - A: reading and filing
   - B: the explanation and clinical read

## Global constraints

The same as the lab design:
- Expo 57 docs.
- No em dash, en dash or hyphen in UI copy, and `displayCopy()` on all
  remote or model text.
- Jost and the existing design, on Ground.
- Health data is never logged.
- Functions run as her under RLS.
- Absence is never shown as normal.
- Public copy is gender neutral.

---

## Part A: Reading and filing

### Entry

- "Add to Your Records" gets **Scan or Upload a Document**. It offers the
  same three choices as lab reports: Scan a Paper Report (the existing
  document scanner), Upload a PDF, Choose a Photo.
- Its note path (voice, typing, files kept on the phone) stays for notes
  that are not documents.
- "Add a lab report" on Care stays, and uses the same reader.

### Reading: `document-scan`

- A new edge function, built from `lab-scan`'s chunking:
  - reads PDFs eight pages at a time
  - each piece counts against the daily limit, shared with lab reports
    through `claim_lab_scan`, and renamed in copy to "documents"
  - unreadable pages are named
- The chunk planner, merge and PDF splitting move to
  `supabase/functions/_shared/` so `lab-scan` and `document-scan` use one
  copy. If the deployed bundler refuses `_shared`, the files are copied,
  with a parity test.
- One strict schema. The model returns `doc_type`, and fills only the
  section for that type. It is told to copy, never interpret.

| doc_type | Fields |
|---|---|
| `lab_report` | the existing lab fields (tests, panels, collected_on, lab, ordering_clinician, specimen) |
| `visit` | `date`, `clinician`, `facility`, `reason`, `diagnoses[] {name, status: new or existing or unclear}`, `medications_started[]`, `medications_stopped[]`, `medications_changed[]` (each `{name, strength, dose, frequency, route}`), `procedures[] {name, date}`, `follow_ups[] {specialty, clinician, reason, when}`, `instructions[]` (text as written), `allergies[] {substance, reaction}` |
| `imaging` / `pathology` | `date`, `study` (modality or specimen), `body_site`, `findings` (text as printed), `impression` (text as printed), `named_conditions[]`, `clinician`, `facility` |
| `prescription` | `medications[] {name, strength, dose, frequency, route, prescriber, date}` |
| `referral` | `specialty`, `clinician`, `reason`, `referred_by`, `date` |
| `insurance` | `provider`, `plan`, `member_id` |
| `other` | `title`, `date`, `description` (one line: what it is) |

Every type also returns `not_medical`, `unreadable_pages` and
`multiple_dates`.

- If it is a `lab_report`, the app sends the same file through the existing
  lab flow, so lab reading is not duplicated.
- `readDocumentScan(json)` in `src/lib/documents.ts` checks every field the
  way `readLabScan` does. Anything malformed drops that item rather than
  passing through.

### Checking

- A review screen (`AddDocumentScreen`) shows what kind of document it was
  read as. She can change the type, and that reads the file again as the
  chosen type.
- The items found are grouped under where they will be filed: "Adds to
  Conditions", "Adds to Medications", "Adds to Procedures", "Adds to
  Referrals", "Updates Health Plans".
- Each item can be edited or switched off.
- Items that are already in her lists are marked "Already in your
  Medications". They are linked rather than added again, matched by folded
  name.
- An insurance card that differs from her current plan asks: "Replace
  your current plan?"
- Nothing is saved until she confirms. Unreadable pages and multiple
  dates are warned about, as with labs.

### Saving: `save_document`

- One security invoker RPC writes:
  - the `documents` row: `doc_type`, `title`, `occurred_at`, and
    `metadata.extraction` with what was read, its checksum and the page
    count
  - the filed rows, all with `provenance = 'DOCUMENT'` and a new nullable
    `document_id` column referencing `documents` on delete cascade:
    - conditions (kind `condition`, with `status` active for a new
      diagnosis and unknown otherwise)
    - allergies as conditions of a new kind `allergy`
    - medications (started: `started_on` the document date; stopped: an
      existing match gets `stopped_on` the document date, or a new row is
      made with both dates)
    - procedures
    - referrals (steps `{referred: date}`)
  - the profile's insurance, only when she chose to replace it
- All of it is written together or not at all.
- **Already present items** are not inserted. The link is kept in
  `metadata.linked` (table and id) so the document screen can show them.
- **The original** is uploaded first to
  `<uid>/documents/<document_id>.<ext>`. If the RPC fails, it is removed.
- **Duplicates:** the same checksum says "You added this document on…"
  and opens it.

### Removing

`remove_document` deletes the document and its stored file. Everything it
filed goes with it by the cascade. Rows it only linked to are untouched.
Insurance it replaced is not restored; the confirmation says so.

### The document screen (`DocumentScreen`)

- **What it shows:**
  - the type, date, clinician and facility
  - each section read from the document (for imaging and pathology, the
    findings and impression in full)
  - each filed item, with where it went
  - View original, and Remove
- **How you get there:**
  - after saving
  - from Records, which gains a "Documents" list, newest first
  - from a filed item's "From a document" line
- Lab reports keep `LabReportScreen`.

---

## Part B: Explanation and full clinical read

### Flow

- After saving a non lab document, the app calls `document-analysis` with
  the document id, as with labs. The analysis is stored, marked out of date
  when its facts change, and can be analysed again.
- A daily limit is shared with lab analyses (`claim_lab_analysis`, 20 a
  day).

### Facts

- what was read from the document (its extraction, after her edits)
- her record:
  - conditions
  - medications and supplements
  - labs from the last 12 months, the latest of each test
  - cycle day at the document date, sent by the app as with labs
  - symptoms in the 30 days around the document date
  - age range, life stage and gender
  - procedures

### Output schema

- `urgent[] {item, reason, action}`
- `summary`
- `terms[] {term, meaning}`: terms from the document explained plainly
- `findings[] {item, explanation, relevance}`
- `patterns[] {title, items[], explanation}`: across her record
- `considerations[] {condition, items[], confidence, how_confirmed}`
- `next_steps[] {step, reason}`
- `questions[]`

### Checking (`checkDocumentAnalysis`, pure, tested from the app)

An analysis is refused if any of these hold:

- A `term` does not appear in the document's text fields, after folding.
- An `item` names something that is neither in the document nor in her
  record.
- A number in any text is in no fact: document dates, doses as printed,
  lab values, ranges, the cycle day, counts 1 to 12, or the age range.
- **Doses and medication changes:**
  - A dose may appear only exactly as printed in the document, for that
    medication.
  - A start, stop, increase or decrease of a medication may appear only
    when the document's own instructions or medication lists say it, and
    the sentence attributes it to the document ("Your discharge papers say
    to stop…").
  - Anything else of that kind is refused.
- `urgent` is empty when the document's instructions or impression contain
  an urgent marker (for example "urgent", "critical", "go to the emergency",
  "call 911"). The banner also shows those words from the extraction
  itself.
- It runs past the size bounds: 12 terms, 12 findings, 8 patterns, 6
  considerations, 8 next steps, 10 questions.

As with labs, a refused answer is retried once, then she is told it could
not be checked. It is stored only by the function, with the service role,
in a new `document_analyses` table, the same shape as `lab_analyses`.

### Display

On the document screen, below the sections:
- the label "Clinical AI analysis. Not a diagnosis. Discuss it with your
  clinician.", the model and date
- urgent
- summary
- terms explained
- findings, patterns, conditions to consider, next steps, questions
- Share or Print

### Privacy Policy

"Lab reports you add" becomes "documents you add (lab reports, visit
summaries, imaging and pathology reports, prescriptions, referrals and
insurance cards)", and the OpenAI row says it reads documents. It is
deployed with her go ahead.

---

## Testing

- **Pure:**
  - `readDocumentScan` for each type
  - matching to existing items
  - building the save payload
  - `checkDocumentAnalysis` (one failing test per rule, plus a passing
    fixture)
  - the shared chunk code, with a parity test if it is copied
- **SQL:**
  - `save_document` is atomic, owner scoped and refuses a path outside her
    folder
  - removal cascades filed rows but not linked ones
  - `document_analyses` is written only by the service role
  - the grants allow list
  - export coverage for new columns and tables
- **End to end, local, with a fake model:** `document-scan` and
  `document-analysis`, as for lab analysis.
- **Device:** the user's own documents, in a release build on their phone,
  then TestFlight.

## Out of scope

- Reading handwriting reliably. The model tries, and she checks every item.
- Documents in languages other than English.
- Faxing or sending documents onward.
- Editing an analysis.

## Risks

- **Medication instructions:** quoting a clinician's instruction is the
  closest this comes to advice about medication. The check allows only
  attributed quotes that match the document, and the label always shows.
- **Misclassification:** she can change the type, and nothing is filed
  without her check.
- **Larger extractions mean higher model cost per document.** Bounded by the
  shared daily limits.
