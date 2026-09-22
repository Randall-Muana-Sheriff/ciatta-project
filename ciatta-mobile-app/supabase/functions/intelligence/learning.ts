// What was learned since the last run, as events that each land once. A
// lesson is a pattern that came back (a thread's count rose), an insight
// rewritten, an outcome the server measured, or one she reported. The key
// is what makes it land once: the same input on a later run produces the
// same keys, and the unique index on (user_id, key) does the rest.
// Summaries come from wording.ts; nothing here writes a sentence.
//
// Plain TypeScript, no Deno or Supabase imports, tested from
// src/data/learning.test.ts.

import { learningText, type OutcomeValue } from './wording.ts';

export type ThreadCount = { id: string; key: string; status: string; observation_count: number };
export type WrittenInsight = { id: string; thread_id: string; status: 'new' | 'updated' | 'continuing' };
export type MeasuredForLearning = {
  outcomeId: string;
  actionId: string;
  actionTitle: string;
  threadId: string | null;
  metric: string | null;
  measured: OutcomeValue;
  ratio: number | null;
};
export type ReportedForLearning = { outcomeId: string; actionId: string; actionTitle: string; threadId: string | null; reported: OutcomeValue };

export type LearningInput = {
  // Thread counts as they stood before this run, by thread id.
  before: ThreadCount[];
  after: ThreadCount[];
  insightsWritten: WrittenInsight[];
  measured: MeasuredForLearning[];
  reported: ReportedForLearning[];
};

export type LearningType = 'pattern_recurred' | 'pattern_resolved' | 'outcome_measured' | 'outcome_reported' | 'insight_updated';

export type LearningCandidate = {
  key: string;
  type: LearningType;
  threadId: string | null;
  actionId: string | null;
  outcomeId: string | null;
  summary: string;
  evidence: Record<string, unknown>;
};

export function buildLearningEvents(input: LearningInput): LearningCandidate[] {
  const out: LearningCandidate[] = [];
  const before = new Map(input.before.map((t) => [t.id, t]));

  for (const t of input.after) {
    const prior = before.get(t.id);
    if (prior && t.observation_count > prior.observation_count) {
      out.push({
        key: `pattern_recurred:${t.id}:${t.observation_count}`,
        type: 'pattern_recurred',
        threadId: t.id,
        actionId: null,
        outcomeId: null,
        summary: learningText({ type: 'pattern_recurred', count: t.observation_count }),
        evidence: { from: prior.observation_count, to: t.observation_count, key: t.key },
      });
    }
    if (prior && t.status === 'resolved' && prior.status !== 'resolved') {
      out.push({
        key: `pattern_resolved:${t.id}`,
        type: 'pattern_resolved',
        threadId: t.id,
        actionId: null,
        outcomeId: null,
        summary: learningText({ type: 'pattern_resolved' }),
        evidence: { key: t.key, last_count: t.observation_count },
      });
    }
  }

  for (const i of input.insightsWritten) {
    if (i.status !== 'updated') continue;
    out.push({
      key: `insight_updated:${i.id}`,
      type: 'insight_updated',
      threadId: i.thread_id,
      actionId: null,
      outcomeId: null,
      summary: learningText({ type: 'insight_updated' }),
      evidence: { insight_id: i.id },
    });
  }

  for (const m of input.measured) {
    out.push({
      key: `outcome_measured:${m.outcomeId}`,
      type: 'outcome_measured',
      threadId: m.threadId,
      actionId: m.actionId,
      outcomeId: m.outcomeId,
      summary: learningText({ type: 'outcome_measured', action: m.actionTitle, metric: m.metric, measured: m.measured, ratio: m.ratio }),
      evidence: { measured: m.measured, metric: m.metric, ratio: m.ratio },
    });
  }

  for (const r of input.reported) {
    out.push({
      key: `outcome_reported:${r.outcomeId}:${r.reported}`,
      type: 'outcome_reported',
      threadId: r.threadId,
      actionId: r.actionId,
      outcomeId: r.outcomeId,
      summary: learningText({ type: 'outcome_reported', action: r.actionTitle, reported: r.reported }),
      evidence: { reported: r.reported },
    });
  }

  return out.sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0));
}
