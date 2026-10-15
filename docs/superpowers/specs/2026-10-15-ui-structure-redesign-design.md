# UI structure redesign: Today's patterns, corner navigation, three places

Date: 2026-10-15
App: `ciatta-mobile-app` (Expo 57, React Native)
Status: approved in conversation ("yes write the spec and build it")

## Goal

Make Ciatta simpler to move around without losing anything it shows. It
moves from four tabs to three places (Today, Health, Care). The bottom tab
card becomes two buttons in the bottom right corner. The Today's patterns
card opens into a detail view that can switch to the Journey timeline.

## Decisions taken in conversation

1. **The visual design does not change.** The dark photographic Ground,
   Jost, the existing cards, chips, colours and type all stay. The
   references in `ciatta-visual-assets` inform layout and content only.
2. **Every visualization stays.** Nothing is removed, only moved.
3. **Personalization at the top.** "Good morning, Maya" stays at the top of
   Today.
4. **The Today's patterns card stays as it is.** Its content is:
   - the summary lines (for example, heart rate today and HRV against her usual)
   - the metric chips
   - the day chart
   - the cycle day and phase

   Its title is "Today's patterns". The whole card becomes tappable.
5. **Tapping the card opens a detail view** with a toggle, Today | Journey:
   - **Today** is the card's detail, in full.
   - **Journey** is the graph from the current Journey screen, unchanged.
6. **Three places: Today, Health, Care.** Journey stops being a tab.
7. **Corner navigation.**
   - The bottom tab card is replaced by two round buttons in the bottom right corner: **+** (Log) and **≡** (menu), side by side.
   - ≡ opens a small menu card above them with Today, Health, Care and Profile, marking the current place.
8. **Health gets a search bar and a Timeline row.** It keeps Body and
   Records.

## Part 1: Corner navigation

- **`CornerNav`** (in `ui/chrome.tsx`) replaces `BottomNav`. It is two round
  buttons in the existing style of the + button (`G.pill` fill, the same
  shadow), anchored bottom right above the home indicator:
  - **+** pushes `quickLog`, as today.
  - **≡** toggles the menu.
- **The menu card** uses the existing card surface (`G.card`, hairline
  `G.rule`, the same radius and shadow as the old bar):
  - It sits just above the buttons, right aligned.
  - Its rows are Today, Health, Care and Profile, each with its existing icon.
  - The current place is marked with the selected fill (`G.fillSelected`) and a dot.
  - Choosing a row goes there and closes the menu. So does tapping outside the menu or tapping ≡ again.
  - Profile pushes `profile` on the current place's stack.
- **The menu's items** come from a pure list in `navigation.ts`
  (`MENU_ITEMS`), so the order and labels are tested.
- **Navigation types:**
  - `Tab` becomes `'today' | 'myhealth' | 'care'`.
  - Journey becomes a detail `Screen`, `'journey'`, so "View Cycle Journey" on the Cycle screen and the Health Timeline row push it.
  - Android back behaves as before: back pops a detail, and from Health or Care it returns to Today.
- **Space:**
  - `NAV_CLEARANCE` stays, so scroll content clears the buttons.
  - The menu covers nothing until it is opened.
- **Today's top row:**
  - The top left hamburger, which only opened Profile, is removed. An equal width spacer keeps the CIATTA wordmark centred.
  - The calendar button stays.

## Part 2: Today

- **The order and content are unchanged.** From the top:
  1. the wordmark row
  2. "Good morning, Maya"
  3. the Today's patterns card
  4. the product in use
  5. Metrics
  6. Insights
  7. What you could try
  8. Symptoms
  9. Latest activity
  10. You can log
- **The Today's patterns card:**
  - The heading row gains a chevron.
  - The card is a `Pressable` that pushes `patterns`.
  - The metric chips inside it still switch the pair, as now. A chip press does not open the detail.
  - The cycle row keeps its own action when no cycle is logged.
  - Title: "Today's patterns".

## Part 3: Today's patterns detail (`PatternsScreen`)

- **Layout:** a `DetailScreen` titled "Today's patterns", with the date on
  the right. Under the title is a `SegmentedControl` with two segments,
  Today and Journey. The last choice is remembered for the session.
- **Today:**
  - **`DayPair` in full:** the summary is not limited to three lines, and the chart is taller (180).
  - **"Every reading today":** one row per metric with data today, showing its label, today's range and her usual where there is a baseline.
  - **The cycle row:** day and phase, or "No logged cycle" with Log a period.
  - It reads the same data as Today: intraday readings since midnight, baselines and the cycle.
- **Journey:**
  - `JourneyScreen` is rendered embedded (`embedded` prop): no large title and no outer scroll view.
  - It is otherwise identical: the view picker, the lanes, the legend chips, and opening on Day.

## Part 4: Health

- **A search bar** on top, with the placeholder "Search your health".
  - It searches labs (name), documents (title and type), records from providers (name), and the places in the app: Body systems, Labs, Cycle, Records, Documents, Timeline, Medications, Symptoms, Journal.
  - Results show under the bar. Tapping one opens it: a lab opens its detail through `chooseLab`, a document through `chooseDocument`, a provider record opens `chart`, and a place opens its screen or segment.
  - The match is pure (`lib/healthSearch.ts`): case insensitive and whole word prefix, so "ferr" finds Ferritin.
- **Below the bar**, the Body | Records segment stays as now, and a
  **Timeline** row opens `journey`.

## Testing

- **Pure, under `npm test`:**
  - `MENU_ITEMS`: the order, the labels, and that the current place is marked
  - `healthSearch`: prefix matching, case, each kind routes to its screen, an empty query returns nothing, and results are capped at 20
  - the "every reading" rows: label, range, usual only when known
- **`tsc`**, and the full suite stays green.
- **Device:**
  - the menu opens and closes and goes to each place
  - + opens Log
  - the card opens the detail, the toggle switches, and Journey scrolls sideways
  - search finds a lab and opens it

## Out of scope

- Any colour, type or surface change.
- Engine changes. The intelligence engine is the next spec.
- The condition focus spec, which stays separate.
