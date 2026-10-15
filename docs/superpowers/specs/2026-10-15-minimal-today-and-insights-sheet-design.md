# Minimal Today and the Insights sheet

Date: 2026-10-15
Status: requested in conversation and built. Follows the Lotus home
concept: a calm top, and insights in a sheet that slides up.

## What changed

- **Today:**
  - No CIATTA wordmark. "Good morning, Maya" is the top, with the calendar
    beside it.
  - Then Ciatta's check in, "Ask Ciatta anything", and the product in use.
  - The Today's patterns card and the Symptoms section are gone from
    Today.
- **The Insights sheet** (`ui/InsightsSheet`):
  - It rests over the lower 44% of Today, showing its header and the first
    pattern.
  - Pulling it up, or tapping its header, opens it to the full screen with
    every pattern for the day.
  - A pull down from the top of the list, or the header, settles it again.
  - Tapping a pattern opens its page (`insight`).
- **The pattern page (`InsightScreen`):**
  - **Toggle:** Insight | Metrics.
  - **Highlights** open with "For you" (`lib/patternContext`):
    - the record lines it rests on
    - her readings against her own usual, with the range and on how many
      days, for the metrics this pattern is about
    - where she is in her cycle

    Then "What research says".
  - **Metrics** is the Journey timeline, with a second toggle:
    Timeline | Each metric. Each metric shows the individual metric tiles,
    the pattern's own metrics first, each opening its own page.
- **The visual design does not change.** The sheet sits on the same ground
  as every screen.

## Tests

- `patternContext`: reading lines with her usual and day counts, the cycle
  line added once, readings within her usual skipped, and the metrics each
  pattern points at.
