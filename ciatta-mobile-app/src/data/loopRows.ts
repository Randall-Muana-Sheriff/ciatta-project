import type { Intervention } from '../lib/engine';

// Projects get_today() into the shapes the store and the adapter read. The
// server computes "since" and words every offer and lesson; this file
// renames columns, keeps unknowns null, and turns her walk actions into
// the Intervention shape the engine already reads for "after your planned
// walks". Pure, so the test hands it a get_today document.

export type Since = 'new' | 'updated' | 'continuing' | 'resolved' | 'unchanged';
export type OutcomeValue = 'improved' | 'unchanged' | 'worse' | 'insufficient_evidence' | 'unknown';

export type LoopInsight = {
  id: string;
  title: string;
  status: string;
  since: Since;
  threadId: string;
  threadKey: string;
  threadStatus: string;
  observationCount: number;
};
export type LoopRecommendation = {
  id: string;
  type: string;
  title: string;
  body: string;
  status: string;
  insightId: string | null;
  threadId: string | null;
  changeId: string | null;
};
export type LoopOutcome = { reported: OutcomeValue | null; measured: OutcomeValue | null };
export type LoopAction = {
  id: string;
  kind: string;
  title: string;
  intent: string | null;
  metric: string | null;
  wanted: 'higher' | 'lower' | null;
  startedOn: string;
  status: string;
  outcome: LoopOutcome | null;
};
export type LoopLearning = { id: string; type: string; summary: string; occurredAt: string };
export type TodayLoop = {
  lastVisitAt: string | null;
  insight: LoopInsight | null;
  recommendations: LoopRecommendation[];
  actions: LoopAction[];
  learning: LoopLearning[];
};

type Raw = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);

export function todayLoop(raw: unknown): TodayLoop | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Raw;
  const i = r.insight && typeof r.insight === 'object' ? (r.insight as Raw) : null;
  return {
    lastVisitAt: str(r.last_visit_at),
    insight: i
      ? {
          id: String(i.id),
          title: String(i.title ?? ''),
          status: String(i.status ?? ''),
          since: (str(i.since) as Since) ?? 'unchanged',
          threadId: String(i.thread_id),
          threadKey: String(i.thread_key ?? ''),
          threadStatus: String(i.thread_status ?? ''),
          observationCount: typeof i.observation_count === 'number' ? i.observation_count : 0,
        }
      : null,
    recommendations: arr(r.recommendations).map((x) => ({
      id: String(x.id),
      type: String(x.type),
      title: String(x.title ?? ''),
      body: String(x.body ?? ''),
      status: String(x.status ?? ''),
      insightId: str(x.insight_id),
      threadId: str(x.thread_id),
      changeId: str(x.change_id),
    })),
    actions: arr(r.actions).map((x) => {
      const o = x.outcome && typeof x.outcome === 'object' ? (x.outcome as Raw) : null;
      return {
        id: String(x.id),
        kind: String(x.kind),
        title: String(x.title ?? ''),
        intent: str(x.intent),
        metric: str(x.metric),
        wanted: (str(x.wanted) as 'higher' | 'lower' | null) ?? null,
        startedOn: String(x.started_on),
        status: String(x.status ?? ''),
        outcome: o ? { reported: (str(o.reported) as OutcomeValue | null) ?? null, measured: (str(o.measured) as OutcomeValue | null) ?? null } : null,
      };
    }),
    learning: arr(r.learning).map((x) => ({ id: String(x.id), type: String(x.type), summary: String(x.summary ?? ''), occurredAt: String(x.occurred_at) })),
  };
}

// Today's kicker. Mirrors sinceText in the intelligence function's
// wording module; the test keeps the two in step.
export function sinceCopy(since: Since): string {
  switch (since) {
    case 'new':
      return 'New since your last visit';
    case 'updated':
      return 'Updated since your last visit';
    case 'continuing':
      return 'Seen again since your last visit';
    case 'resolved':
      return 'Resolved since your last visit';
    case 'unchanged':
      return 'No meaningful change since your last visit';
  }
}

// Her walks, in the shape the engine reads to say what followed them.
export function interventionsFrom(actions: LoopAction[]): Intervention[] {
  return actions.filter((a) => a.kind === 'walk').map((a) => ({ id: a.id, kind: 'walk', date: a.startedOn }));
}

// The watch flag Today and the Insight screen read, from the thread's
// status. No insight, nothing watched.
export function watchingFrom(loop: TodayLoop | null): Record<string, boolean> {
  return loop?.insight ? { nextCycle: loop.insight.threadStatus === 'watching' } : {};
}
