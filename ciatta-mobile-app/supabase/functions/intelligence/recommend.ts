// What to offer her, and only what the record can ground. Every candidate
// points at exactly one stored thing (an insight, a thread, or a change)
// and carries a key, so the function can upsert the same offer run after
// run without resurrecting one she dismissed. Titles and bodies come from
// wording.ts; nothing here writes a sentence.
//
// The one `try` is the short walk the app engine already suggests
// (walkSuggestion in src/lib/engine.ts): steps sustained below usual, low
// or unrecorded energy, no severe pain in the last two days. The engine
// reads a streak; the server reads the change row the baselines run wrote
// for that streak, detected within the last few days.
//
// Plain TypeScript, no Deno or Supabase imports, tested from
// src/data/recommend.test.ts.

import { type ChangeRow, daysApart } from './threads.ts';
import { recommendationText, type RecommendationKind } from './wording.ts';

export type LiveInsight = { id: string; thread_id: string; status: string; valid_to: string | null };
export type ThreadRef = { id: string; key: string; status: string; observation_count: number };
export type MetricDay = { day: string; steps: number | null; energy: number | null };
export type PainEpisode = { occurred_on: string; severity: number | null };
export type OpenAction = { kind: string; started_on: string };

export type RecommendInput = {
  today: string;
  insights: LiveInsight[];
  threads: ThreadRef[];
  changes: ChangeRow[];
  dailyMetrics: MetricDay[];
  painEpisodes: PainEpisode[];
  openActions: OpenAction[];
};

export type RecommendationCandidate = {
  key: string;
  type: RecommendationKind;
  insightId?: string;
  threadId?: string;
  changeId?: string;
  title: string;
  body: string;
};

// A steps change older than this is about a different stretch of days.
export const WALK_CHANGE_DAYS = 3;
// The engine's ceiling: energy averaging above this over the last week
// means there is nothing a walk is being offered for.
export const WALK_ENERGY_CEILING = 2.8;
// Pain at or above this in the last two days means rest may be the better
// choice, and no walk is offered.
export const WALK_PAIN_FLOOR = 8;
// A thread seen this often is worth a conversation.
export const PREPARE_AFTER = 3;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const within = (day: string, today: string, days: number) => {
  const gap = daysApart(day, today);
  return gap >= 0 && gap <= days;
};

export function buildRecommendations(input: RecommendInput): RecommendationCandidate[] {
  const out = new Map<string, RecommendationCandidate>();
  const put = (c: RecommendationCandidate) => {
    if (!out.has(c.key)) out.set(c.key, c);
  };
  const threads = new Map(input.threads.map((t) => [t.id, t]));

  for (const insight of input.insights) {
    if (insight.valid_to != null || insight.status === 'dismissed' || insight.status === 'resolved') continue;
    const thread = threads.get(insight.thread_id);
    if (!thread) continue;
    const cycle = thread.key.split('~').includes('cycle_length');
    const watch: RecommendationKind = thread.status === 'watching' ? 'continue' : 'observe';
    put({ key: `${watch}:${thread.id}`, type: watch, threadId: thread.id, ...recommendationText(watch, { cycle }) });
    put({ key: `reflect:${insight.id}`, type: 'reflect', insightId: insight.id, ...recommendationText('reflect') });
    put({ key: `review:${insight.id}`, type: 'review', insightId: insight.id, ...recommendationText('review') });
    if (thread.observation_count >= PREPARE_AFTER) {
      put({ key: `prepare:${thread.id}`, type: 'prepare', threadId: thread.id, ...recommendationText('prepare') });
    }
  }

  // The walk: grounded in the most recent sustained drop in steps.
  const drop = input.changes
    .filter((c) => c.metric === 'steps' && c.direction === 'lower' && within(c.detected_on, input.today, WALK_CHANGE_DAYS))
    .sort((x, y) => (x.detected_on < y.detected_on ? 1 : x.detected_on > y.detected_on ? -1 : 0))[0];
  if (drop) {
    const energies = input.dailyMetrics
      .filter((d) => within(d.day, input.today, 6) && d.energy != null)
      .map((d) => d.energy as number);
    // No check ins is not "0 of 5": it cannot veto the offer.
    const energyLow = energies.length === 0 || mean(energies) <= WALK_ENERGY_CEILING;
    const inPain = input.painEpisodes.some(
      (p) => p.severity != null && p.severity >= WALK_PAIN_FLOOR && within(p.occurred_on, input.today, 2)
    );
    const walkedToday = input.openActions.some((a) => a.kind === 'walk' && a.started_on === input.today);
    if (energyLow && !inPain && !walkedToday) {
      put({ key: `try:walk:${drop.id}`, type: 'try', changeId: drop.id, ...recommendationText('try', { kind: 'walk' }) });
    }
  }

  return [...out.values()].sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0));
}
