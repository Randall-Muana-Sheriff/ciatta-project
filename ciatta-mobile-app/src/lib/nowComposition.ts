import { displayCopy, displayCopyMaybe } from './displayCopy';
import { isEligibleCareConnection } from './careConnection';
import type { Domain, Strength } from './types';

/** Must match sleepAnalysis.ts BASELINE_MIN_NIGHTS. Not a new threshold. */
export const SLEEP_BASELINE_MIN_NIGHTS = 14;

export type NowKind = 'building' | 'quiet' | 'surfaced';

export interface NowChange {
  statement: string;
  comparedWith: string;
  period: string;
  observed: string | null;
}

export interface NowContext {
  observed: string;
  interpretation: string;
  limits: string;
  doesNotMean: string;
}

export interface NowAction {
  guidance: string;
  domain: Domain;
  careEligible: boolean;
}

export interface NowComposition {
  kind: NowKind;
  change: NowChange | null;
  /** Always null until production recurrence criteria exist. Never a Relationship. */
  pattern: string | null;
  context: NowContext | null;
  action: NowAction | null;
  buildingHas: string | null;
  buildingMissing: string | null;
  quietMessage: string | null;
  userNote: string | null;
}

export interface NowUnderstanding {
  domain: Domain;
  strength: Strength;
  narrative: string;
  observations_count: number;
  first_observed: string | null;
  last_updated: string;
  guidance: string | null;
}

export interface NowRelationship {
  from_domain: Domain;
  to_domain: Domain;
}

function formatDay(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return displayCopy(
    d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
  );
}

function pickFeatured(rows: NowUnderstanding[]): NowUnderstanding | null {
  const ranked = [...rows].sort(
    (a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
  );
  const sleep = ranked.find((r) => r.domain === 'sleep');
  return sleep ?? ranked[0] ?? null;
}

function relationshipContext(rows: NowRelationship[]): string | null {
  const pair = rows.find(
    (r) =>
      (r.from_domain === 'cycle' && r.to_domain === 'mood') ||
      (r.from_domain === 'mood' && r.to_domain === 'cycle')
  );
  if (!pair) return null;
  return displayCopy(
    `In your data, ${pair.from_domain} and ${pair.to_domain} have shown up together. That is an association, not a cause.`
  );
}

export function composeNow(input: {
  sleepNightCount: number;
  hasHealthObservations: boolean;
  understandings: NowUnderstanding[];
  relationships: NowRelationship[];
  lastNightSleepLabel: string | null;
  userNote: string | null;
}): NowComposition {
  const note = displayCopyMaybe(input.userNote);
  const featured = pickFeatured(input.understandings);

  if (!featured) {
    if (input.sleepNightCount >= SLEEP_BASELINE_MIN_NIGHTS) {
      return {
        kind: 'quiet',
        change: null,
        pattern: null,
        context: null,
        action: null,
        buildingHas: null,
        buildingMissing: null,
        quietMessage: displayCopy(
          'Ciatta has enough of your recent nights to compare. Nothing is different enough from your usual to show right now. Ciatta will look again.'
        ),
        userNote: note,
      };
    }

    const hasSleep = input.hasHealthObservations || input.sleepNightCount > 0;
    return {
      kind: 'building',
      change: null,
      pattern: null,
      context: null,
      action: null,
      buildingHas: hasSleep
        ? displayCopy('Ciatta has your sleep.')
        : displayCopy('Ciatta does not have connected sleep yet.'),
      buildingMissing: hasSleep
        ? displayCopy(
            'Comparison starts after more of your own nights. Ciatta uses your history, not a population average.'
          )
        : displayCopy(
            'Connect sleep from Account, or Add what you notice. Comparison starts after more of your own nights.'
          ),
      quietMessage: null,
      userNote: note,
    };
  }

  const start = formatDay(featured.first_observed);
  const end = formatDay(featured.last_updated);
  const period =
    start && end
      ? displayCopy(`From ${start} through ${end}.`)
      : displayCopy('Across the nights Ciatta can use from your own history.');

  const observed =
    featured.domain === 'sleep' && input.lastNightSleepLabel
      ? input.lastNightSleepLabel
      : note;

  const association = relationshipContext(input.relationships);
  const interpretation = association ?? displayCopy(featured.narrative);
  const context: NowContext = {
    observed: observed
      ? displayCopy(`Your data. ${observed}`)
      : displayCopy(
          `Your data. ${featured.observations_count} observations in ${featured.domain}.`
        ),
    interpretation: displayCopy(`What Ciatta is saying. ${interpretation}`),
    limits: displayCopy(
      'What Ciatta does not know: why this is happening, what will happen next, or whether this needs care.'
    ),
    doesNotMean: displayCopy(
      'What this does not mean: diagnosis, causation, treatment, hormones, PMS, or PMDD.'
    ),
  };

  const action = isEligibleCareConnection(featured)
    ? {
        guidance: displayCopy(featured.guidance ?? ''),
        domain: featured.domain,
        careEligible: true,
      }
    : null;

  return {
    kind: 'surfaced',
    change: {
      statement: displayCopy(featured.narrative),
      comparedWith: displayCopy('Compared with your own recent history. Not with other people.'),
      period,
      observed,
    },
    pattern: null,
    context,
    action,
    buildingHas: null,
    buildingMissing: null,
    quietMessage: null,
    userNote: note,
  };
}
