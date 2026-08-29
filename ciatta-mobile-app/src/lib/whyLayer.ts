import { displayCopy } from './displayCopy';
import type { Domain, Strength } from './types';
import type { InsightViewModel } from './insightViz';

export type WhyPriority = {
  text: string;
  measured: boolean;
  consider?: string;
};

export type WhyUnderstanding = {
  id: string;
  domain: Domain;
  strength: Strength;
  narrative: string;
  seeing?: string | null;
  still_learning: string[];
  last_updated: string;
  observations_count: number;
  confidence_label: string | null;
  learning_since: string | null;
  first_observed: string | null;
  guidance: string | null;
  evidence_summary?: string | null;
  evidence_signal?: string | null;
  baseline_value?: number | null;
  baseline_unit?: string | null;
  baseline_window_days?: number | null;
  baseline_summary?: string | null;
  change_summary?: string | null;
  related_domains?: Domain[];
};

export type WhyRelationship = {
  from_domain: Domain;
  to_domain: Domain;
};

export type WhyCrossDomain = {
  from_domain: Domain;
  to_domain: Domain;
  narrative: string;
};

export type WhyHistory = {
  understanding_id: string;
  event_date: string;
  label: string;
};

const THIN_STRENGTH: Strength[] = ['emerging', 'moderate'];

export type WhyRelated = {
  domain: Domain;
  text: string;
};

export type WhyLayer = {
  mattering: string | null;
  evidence: string | null;
  related: WhyRelated[];
  watching: string | null;
  history: string[];
  primaryViz: InsightViewModel | null;
  supporting: InsightViewModel[];
};

export type WhyLayerInput = {
  featured: WhyUnderstanding;
  todayNarrative: string;
  todayPriority: WhyPriority | null;
  understandings: WhyUnderstanding[];
  relationships: WhyRelationship[];
  crossDomain: WhyCrossDomain[];
  history: WhyHistory[];
  candidates: InsightViewModel[];
  todayVizId?: string | null;
};

function norm(value: string): string {
  return displayCopy(value)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function overlaps(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return false;
  if (left === right) return true;
  return left.includes(right) || right.includes(left);
}

function lowerFirst(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

function provenanceCopy(featured: WhyUnderstanding): string | null {
  const signal = featured.evidence_signal ?? '';
  if (signal === 'health_concern' || signal === 'health_concern_detail') {
    return displayCopy('This comes from what you shared, not a device measurement.');
  }
  if (signal === 'mood_rating' || signal === 'energy_rating') {
    return displayCopy('This comes from check ins you reported, kept apart from device readings.');
  }
  return null;
}

function fallbackEvidenceCopy(featured: WhyUnderstanding): string {
  const n = featured.observations_count ?? 0;
  const thin = n < 8 || THIN_STRENGTH.includes(featured.strength);
  if (n <= 0) {
    return displayCopy("There isn't a reading on this yet. Ciatta will look as more arrives.");
  }
  const readings = n === 1 ? '1 reading' : `${n} readings`;
  if (thin) {
    return displayCopy(
      `Ciatta has ${readings} to work with. That is not enough yet to see a clear pattern.`
    );
  }
  return displayCopy(`This is grounded in ${readings} Ciatta has already seen.`);
}

function watchingCopy(questions: string[]): string | null {
  const first = questions[0];
  if (!first) return null;
  const text = displayCopy(first);
  const alreadyASentence =
    /[.?!]$/.test(text) || /^(i |we |ciatta )/i.test(text);
  if (alreadyASentence) return text;
  return displayCopy(`Ciatta is watching for ${lowerFirst(text)}.`);
}

const DOMAIN_WORD: Record<Domain, string> = {
  sleep: 'sleep',
  recovery: 'recovery',
  energy: 'energy',
  cycle: 'cycle',
  mood: 'mood',
};

function relatedLine(domain: Domain): string {
  return displayCopy(`This sits beside your ${DOMAIN_WORD[domain]}.`);
}

/**
 * Compose the Why layer from structured Understanding fields.
 * Never invents a pattern. Never repeats Today seeing or guidance.
 */
export function composeWhyLayer(input: WhyLayerInput): WhyLayer {
  const { featured, todayNarrative, todayPriority } = input;
  const seeing = featured.seeing || todayNarrative || featured.narrative;
  const used = [seeing, todayNarrative, todayPriority?.text, todayPriority?.consider, featured.guidance].filter(
    Boolean
  ) as string[];

  const featuredHistory = (input.history ?? []).filter((h) => h.understanding_id === featured.id);
  const history = featuredHistory
    .map((h) => displayCopy(h.label))
    .filter((label) => label && !used.some((u) => overlaps(label, u)));

  const relatedDomains = [
    ...new Set(
      (featured.related_domains ?? []).concat(
        input.relationships
          .filter((r) => r.from_domain === featured.domain || r.to_domain === featured.domain)
          .map((r) => (r.from_domain === featured.domain ? r.to_domain : r.from_domain))
      )
    ),
  ];
  const related = relatedDomains.map((domain) => ({
    domain,
    text: relatedLine(domain),
  }));

  let mattering: string | null = null;
  if (featured.change_summary && !used.some((u) => overlaps(featured.change_summary, u))) {
    mattering = displayCopy(featured.change_summary);
  } else if (history[0] && !overlaps(history[0], seeing)) {
    mattering = history[0];
  }

  const windowCopy =
    featured.baseline_window_days && featured.baseline_window_days > 0
      ? displayCopy(`This looks across the last ${featured.baseline_window_days} days.`)
      : null;

  const evidenceBits = [
    provenanceCopy(featured),
    featured.evidence_summary ? displayCopy(featured.evidence_summary) : fallbackEvidenceCopy(featured),
    featured.baseline_summary && !overlaps(featured.baseline_summary, mattering)
      ? displayCopy(featured.baseline_summary)
      : null,
    windowCopy &&
    !overlaps(windowCopy, featured.baseline_summary) &&
    !overlaps(windowCopy, featured.evidence_summary)
      ? windowCopy
      : null,
    featured.change_summary &&
    !overlaps(featured.change_summary, mattering) &&
    !used.some((u) => overlaps(featured.change_summary, u))
      ? displayCopy(featured.change_summary)
      : null,
  ].filter((bit): bit is string => !!bit && !used.some((u) => overlaps(bit, u)));

  const leftoverQuestions = (featured.still_learning ?? []).filter(
    (q) => !used.some((u) => overlaps(q, u))
  );
  const watching = watchingCopy(leftoverQuestions);

  const vizPool = input.candidates
    .filter((c) => c.kind !== 'still-learning' && c.id !== input.todayVizId)
    .map((c) => {
      if (
        overlaps(c.headline, seeing) ||
        overlaps(c.headline, mattering) ||
        overlaps(c.context, seeing)
      ) {
        return {
          ...c,
          headline: overlaps(c.headline, seeing) || overlaps(c.headline, mattering) ? c.title : c.headline,
          context: overlaps(c.context, seeing) ? c.metricLine : c.context,
        };
      }
      return c;
    });

  return {
    mattering,
    evidence: evidenceBits.length > 0 ? evidenceBits.join(' ') : null,
    related,
    watching,
    history,
    primaryViz: vizPool[0] ?? null,
    supporting: vizPool.slice(1, 3),
  };
}

export function whyAvailable(input: Omit<WhyLayerInput, 'candidates'>): boolean {
  const layer = composeWhyLayer({ ...input, candidates: [] });
  return !!(
    layer.mattering ||
    layer.related.length > 0 ||
    layer.watching ||
    layer.history.length > 0 ||
    layer.evidence ||
    (input.featured.observations_count ?? 0) >= 4
  );
}
