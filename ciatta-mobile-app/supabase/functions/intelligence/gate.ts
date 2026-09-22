// Whether a candidate has earned an insight: every link of the chain from
// finding to relationship to source is traced against the rows it cites,
// and one missing link is the reason the insight is not written. The
// thread is still recorded either way; the gate decides only whether
// wording runs and a row lands in insights.
//
// Interpretation and her context are never gated on. The absence of
// context is stated by wording ("You did not note anything around these
// days") rather than failed here, because a relationship she has not
// commented on is still hers to see.
//
// Plain TypeScript with no Deno or Supabase imports, as threads.ts and
// wording.ts, so src/data/gate.test.ts can exercise it under node:test.

import { MIN_RECURRENCE, type ChangeRow, type LinkRow, type ObservationRow, type ThreadCandidate } from './threads.ts';

export type GateReason = 'no_finding' | 'no_relationship' | 'no_source' | 'insufficient_recurrence' | 'stale';
export type GateResult = { pass: true } | { pass: false; reason: GateReason };

// The rows the candidate cites, as read from the window.
export type GateRows = { changes: ChangeRow[]; links: LinkRow[]; observations: ObservationRow[] };

// An insight about something that stopped recurring four months ago is not
// today's insight. The thread stays; the insight is not written until the
// relationship is seen again.
export const STALE_DAYS = 120;

const DAY_MS = 86400000;
function dayMs(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
const daysApart = (a: string, b: string) => Math.round((dayMs(b) - dayMs(a)) / DAY_MS);

// A measured observation must say which device it came from; a reported
// one is hers, and needs no device.
const sourced = (o: ObservationRow) => o.source_id != null || o.provenance === 'REPORTED';

export function gate(candidate: ThreadCandidate, rows: GateRows, today: string): GateResult {
  // Finding: at least one side has a change row, and it is one the
  // candidate cites and the window still holds.
  const changeIds = new Set(rows.changes.map((c) => c.id));
  if (!candidate.evidence.some((e) => e.changeId && changeIds.has(e.changeId))) return { pass: false, reason: 'no_finding' };

  // Relationship: every occurrence traces to a link row that joins the
  // same two observations. A candidate with no occurrences has nothing to
  // trace at all.
  const links = new Map(rows.links.map((l) => [l.id, l]));
  if (!candidate.occurrences.length) return { pass: false, reason: 'no_relationship' };
  for (const o of candidate.occurrences) {
    const link = links.get(o.linkId);
    const joins =
      link &&
      ((link.a_observation_id === o.aObservationId && link.b_observation_id === o.bObservationId) ||
        (link.a_observation_id === o.bObservationId && link.b_observation_id === o.aObservationId));
    if (!joins) return { pass: false, reason: 'no_relationship' };
  }

  // Recurrence: the builder guarantees this already; asserted again so a
  // future change to the builder cannot slip past.
  if (candidate.recurrence < MIN_RECURRENCE) return { pass: false, reason: 'insufficient_recurrence' };

  // Source: every observation in an occurrence is present and has a source
  // or was reported by her.
  const observations = new Map(rows.observations.map((o) => [o.id, o]));
  for (const o of candidate.occurrences) {
    for (const id of [o.aObservationId, o.bObservationId]) {
      const row = observations.get(id);
      if (!row || !sourced(row)) return { pass: false, reason: 'no_source' };
    }
  }

  if (daysApart(candidate.lastObservedAt, today) > STALE_DAYS) return { pass: false, reason: 'stale' };

  return { pass: true };
}
