# Ciatta home, conversational logging and check ins

Date: 2026-10-15
App: `ciatta-mobile-app`
Status: approved in conversation. Builds on `2026-10-15-ui-structure-redesign-design.md`.

## Goal

Home is Ciatta, the care partner, with the person's day under it. Nothing
is logged by tapping pill grids. Wearables and records arrive on their own.
Ciatta asks one short check in question when the data gives a reason. What
the person wants to add, they say or type to Ciatta, which reads it, shows
what it understood and files it once they confirm.

## Decisions taken in conversation

1. **Home = Ciatta first, the day below.** The Care screen's conversation
   becomes the top of Today.
2. **"Your care" moves into the ≡ menu.** The menu reads Today, Health,
   Your care, Profile. The words "concierge", "Iris" and "Wren" are gone,
   along with the name picker. The assistant is Ciatta.
3. **Manual logging leaves the UI.** That means the Log screen with its
   category tabs and pill grids, "You can log" on Today, and the links into
   the step by step forms. Existing entries can still be opened and
   corrected.
4. **+ opens the Ciatta conversation, ready to talk or type.** A message
   that describes something to log gets the reply "I can add this to your
   timeline: …", with Add and Not this.
5. **Check ins:**
   - one question at a time, chosen by a tested rule from today against the
     person's baselines and conditions
   - tap to answer
   - pushed once a day, privately: "Ciatta has a quick question for you."
     The lock screen never shows a symptom or a reading.
6. **Today is consolidated into two cards.**
   - **Ciatta's card** holds what Ciatta says: the check in, the top
     insights, and What you could try. The box to talk to Ciatta sits under
     it.
   - **The Today's patterns card** holds every visualization behind
     Day | Metrics | Symptoms | Journey.
   - Product in use stays as a slim row. Latest activity is part of the
     Journey view.
7. **The visual design does not change.**
8. **Check ins say what changed, never a forecast.** There is no flare
   warning. The condition focus spec declined those.

## Part 1: Places and navigation

- **Places:**
  - `Tab` stays `'today' | 'myhealth' | 'care'`, and the `care` place
    renders `YourCareScreen`: the large title "Your care" over the existing
    `CareHub` (visits, care team, referrals, requests).
  - Its "ask" action opens the conversation.
- **The conversation** is a detail `Screen`, `'ciatta'`: today's
  `CareScreen` without the Concierge | Your Care switch and without the
  name picker, behind a back header titled "Ciatta".
- **Menu:** `MENU_ITEMS` labels become Today, Health, Your care, Profile.
- **The corner + pushes `ciatta`.** Everything that pushed `quickLog`
  pushes `ciatta` instead: Today, Cycle, Gut, Symptoms, Medications,
  Patterns.
  - The Cycle screen's "Log period" form link opens `ciatta` too.
  - `quickLog` stays registered (an old deep link still resolves) but
    nothing in the UI opens it.
- **Explore and Ask** handoffs (`askCare`) now push `ciatta` rather than
  switching places.
- **Copy:**
  - Greeting: "Hi Maya, I'm Ciatta. I keep watch over your record and get
    things ready for you. What would you like help with first?"
  - The box label is "Ask Ciatta".

## Part 2: Today

From the top:

1. **The wordmark row and "Good morning, Maya".**
2. **Ciatta's card.** It uses the existing card surface, with the avatar
   and "Ciatta" at the top.
   - **The check in**, when the rule gives one: the signal line and the
     question, three answer pills and Not now.
     - Answering saves through the existing save path (`useQuickLogSave`).
       Mild or Strong saves the symptom item with the text
       "Check in: pelvic pain, mild." None saves the note
       "Check in: no pelvic pain."
     - It then shows "Added to your timeline."
     - An answered or Not now check in does not return that day (kept on
       the phone by date).
   - **"Ciatta noticed":** the top insight cards (the existing Insights
     carousel), the same cards and sources.
   - **"What you could try":** the existing action plan list.
3. **"Ask Ciatta anything"**, a box that pushes `ciatta` when tapped.
4. **The Today's patterns card**, with a `SegmentedControl` of Day, Metrics,
   Symptoms and Journey:
   - **Day:** as now (summary, chips, chart, cycle row). Tapping it opens
     the detail.
   - **Metrics:** the six tiles grid as now, with All opening Metrics.
   - **Symptoms:** the existing symptom strips (7, 28, 90 days) and
     Compare. The "+ Symptoms" add button is gone.
   - **Journey:** the Journey timeline embedded, with Latest activity under
     it.
   - The chosen view is shared with the detail screen
     (`state/patternsView`), whose toggle offers Today and Journey as
     before.
5. **Product in use** (`ProductNowCard`), only while one is in.

Removed from Today: "You can log" and its box.

## Part 3: Check in rule (`supabase/functions/_shared/checkIn.ts`, pure)

Shared by the app and the intelligence run, with no imports.

- **Signature:** `checkIn({ today, baselines, conditions, answered })`
  returns `CheckIn | null`.
  - `today`: `{ resting_hr, hrv, sleep_hours, temp_deviation }`, each
    `number | null`
  - `baselines`: rows of `{ metric, low, high, sufficient }`
- **Signals**, the first that holds:
  1. resting_hr above its sufficient `high`: "Your resting heart rate is
     higher than usual today."
  2. hrv below its sufficient `low`: "Your HRV is lower than usual today."
  3. sleep_hours below its sufficient `low`: "You slept less than usual
     last night."
  4. temp_deviation of 0.5 or more: "Your skin temperature is up from your
     usual."
- **The question**, by condition (case insensitive match on her
  conditions):
  - Endometriosis, adenomyosis, pelvic pain or heavy periods: "How is your
    pelvic pain?" The item is `Pelvic pain`, and the answers are None, Mild
    and Strong.
  - Otherwise: "How is your energy?" The item is `Fatigue`, and the answers
    are Fine, Tired and Exhausted. Fine saves a note, and the other two
    save the item.
- **No check in** when no signal holds, when the baseline is not
  sufficient, or when the key is already in `answered`.
- **Key:** `${signal}:${YYYY-MM-DD}`.

## Part 4: Check in push (intelligence run)

- **Migration:** `profiles.notify_checkins boolean not null default true`
  and `profiles.last_checkin_push date`.
- **When it sends.** After the findings push, the run:
  - reads today's `daily_metrics` row and the `baselines` rows (window 90)
  - runs `checkIn`
  - if it returns a check in, notify_checkins is on, and last_checkin_push
    is not today, sends one push: title "Ciatta", body "Ciatta has a quick
    question for you.", data `{ screen: 'today' }`
  - then sets last_checkin_push to today
- **Failure** is logged by name only and never fails the run.
- **The app** opens Today when a push with `screen: 'today'` is tapped.
- **Profile, Notifications** gains a "Check ins" switch beside New
  Findings, bound to notify_checkins.

## Part 5: Conversational logging

- **Edge function `log-read`** (JWT verified, OpenAI as in document-scan,
  model `OPENAI_LOG_MODEL` or `gpt-4o-mini`):
  - **Input:** `{ text, vocabulary }`. Text is up to 1,000 characters.
    Vocabulary is the app's log item words, up to 400 entries of 60
    characters each.
  - **Output:** `{ items: string[], daysAgo: number }`.
  - Items are filtered to the given vocabulary, exact and case insensitive,
    so the model cannot invent a category. daysAgo is clamped from 0 to 14.
  - Text is never logged.
  - It uses the same daily claim as food scan.
  - The fake model mode works for local tests.
- **In the conversation:**
  - A message is considered for logging when it does not end in "?" and
    `classify` does not route it to escalate.
  - The app calls `log-read`. If items come back, it merges them with the
    local reader, `readCategories`, as a fallback when the function fails.
  - Ciatta's turn then reads "I can add this to your timeline: Pain,
    Fatigue." with **Add** and **Not this**.
  - **Add** saves through `useQuickLogSave({ text, key: 'symptoms', tapped:
    items })` and says "Added to your timeline."
  - Words it did not place are kept in the note, as the save path already
    does.
  - A question is still answered by the capabilities as now.
- **Privacy Policy:** OpenAI's row adds "reads messages you send Ciatta to
  add to your timeline".

## Testing

- **Pure:**
  - `checkIn`: each signal, the order of signals, insufficient baselines,
    the condition question, the default energy question, the answered key,
    and the answer to save mapping
  - the `log-read` filter: vocabulary only, case, daysAgo clamping, and
    garbage input
  - `MENU_ITEMS` labels
  - `isLoggable(message)`: a question and an escalation are not loggable
  - the check in push builder: private body, once a day, setting off
- **SQL:** the new profile columns, and a person can update only their own
  notify_checkins.
- **Device:**
  - the home card answers a check in
  - + opens Ciatta
  - "dull ache since lunch, totally drained" offers Pain and Fatigue, and
    Add files them
  - the menu shows Your care
  - no screen shows "concierge"

## Out of scope

- The deeper intelligence engine (the next spec).
- Reading photos in the conversation. Attachments stay as they are. The
  meal, lab and document scanners stay where they are.
