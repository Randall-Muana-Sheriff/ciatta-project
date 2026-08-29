import { assertEquals, assert } from 'jsr:@std/assert@1';
import { composeWhyLayer, whyAvailable, type WhyUnderstanding } from './whyLayer.ts';
import type { InsightViewModel } from './insightViz.ts';

const featured: WhyUnderstanding = {
  id: 'u-sleep',
  domain: 'sleep',
  strength: 'strong',
  narrative: 'Your nights have been shorter than they were last week.',
  observations_count: 18,
  confidence_label: 'Well understood',
  learning_since: '2026-07-01',
  first_observed: '2026-07-01',
  last_updated: '2026-08-27T12:00:00.000Z',
  still_learning: ['What happens on the nights you stay up later', 'How caffeine sits beside this'],
  guidance: 'We have been learning your sleep patterns over the past several weeks. Consider keeping your sleep schedule consistent. If it continues, it may be worth discussing with your primary care provider.',
};

function viz(id: string, title: string): InsightViewModel {
  return {
    id,
    domain: 'sleep',
    catalog: '01',
    title,
    headline: 'Chart headline',
    metricLine: 'Sleep duration | Aug 21 to Aug 27',
    context: 'Context',
    tryLabel: null,
    color: '#5B4B7A',
    kind: 'line',
    points: [],
  };
}

Deno.test('limited evidence is explained without metadata or Today copy', () => {
  const layer = composeWhyLayer({
    featured: {
      ...featured,
      guidance: featured.narrative,
      still_learning: ['What happens on the nights you stay up later'],
      observations_count: 3,
      strength: 'emerging',
      learning_since: '2026-08-24',
      confidence_label: 'still learning',
    },
    todayNarrative: featured.narrative,
    todayPriority: {
      text: "We're still learning what happens on the nights you stay up later.",
      measured: false,
    },
    understandings: [featured],
    relationships: [],
    crossDomain: [],
    history: [],
    candidates: [],
  });
  assertEquals(layer.mattering, null);
  assert(layer.evidence?.includes('3 readings') === true);
  assert(layer.evidence?.toLowerCase().includes('not enough') === true);
  assertEquals((layer.evidence ?? '').toLowerCase().includes('present for'), false);
  assertEquals((layer.evidence ?? '').toLowerCase().includes('still learning'), false);
  assertEquals(layer.watching, null);
  assertEquals(layer.primaryViz, null);
  assertEquals((layer.mattering ?? '').includes('shorter than they were last week'), false);
});

Deno.test('a complete still learning sentence is shown as written', () => {
  const layer = composeWhyLayer({
    featured: {
      ...featured,
      observations_count: 3,
      strength: 'emerging',
      guidance: featured.narrative,
      still_learning: [
        "I don't yet have enough health data to understand what may be contributing to this.",
      ],
    },
    todayNarrative: featured.narrative,
    todayPriority: null,
    understandings: [featured],
    relationships: [],
    crossDomain: [],
    history: [],
    candidates: [],
  });
  assertEquals(
    layer.watching,
    "I don't yet have enough health data to understand what may be contributing to this."
  );
});

Deno.test('Why names user reported provenance without repeating Today', () => {
  const layer = composeWhyLayer({
    featured: {
      ...featured,
      seeing: featured.narrative,
      evidence_summary: 'This is grounded in 12 check ins you reported.',
      evidence_signal: 'mood_rating',
      baseline_summary: null,
      change_summary: null,
      still_learning: ['Ciatta is watching whether Low keeps showing up.'],
    },
    todayNarrative: featured.narrative,
    todayPriority: null,
    understandings: [featured],
    relationships: [],
    crossDomain: [],
    history: [
      { understanding_id: featured.id, event_date: '2026-08-01', label: 'A picture of mood check ins started to show.' },
    ],
    candidates: [],
  });
  assertEquals((layer.evidence ?? '').includes('check ins you reported'), true);
  assertEquals((layer.evidence ?? '').includes('kept apart from device readings'), true);
  assertEquals((layer.mattering ?? '').includes('shorter than they were last week'), false);
});

Deno.test('Why uses persisted change and evidence, not Today seeing', () => {
  const layer = composeWhyLayer({
    featured: {
      ...featured,
      seeing: featured.narrative,
      evidence_summary: 'This is grounded in 18 readings Ciatta has already seen.',
      baseline_summary: 'Your usual night is about 7h 10m.',
      change_summary: '8 of 30 nights sat apart from your usual.',
    },
    todayNarrative: featured.narrative,
    todayPriority: { text: featured.guidance ?? '', measured: true },
    understandings: [featured],
    relationships: [],
    crossDomain: [],
    history: [],
    candidates: [viz('sleep_trend', 'Sleep')],
  });
  assertEquals(layer.mattering?.includes('shorter than they were last week'), false);
  assertEquals(layer.mattering?.includes('8 of 30 nights'), true);
  assertEquals(layer.evidence?.includes('18 readings'), true);
  assertEquals(layer.evidence?.includes('7h 10m'), true);
  assertEquals(layer.primaryViz?.id, 'sleep_trend');
});

Deno.test('Why names related domains without reprinting a neighbor or cross domain narrative', () => {
  const layer = composeWhyLayer({
    featured: { ...featured, related_domains: ['mood'] },
    todayNarrative: featured.narrative,
    todayPriority: null,
    understandings: [
      featured,
      {
        ...featured,
        id: 'u-mood',
        domain: 'mood',
        narrative: 'Out of 12 times you have answered, you have rated your mood as Low 40% of the time.',
      },
    ],
    relationships: [{ from_domain: 'sleep', to_domain: 'mood' }],
    crossDomain: [
      {
        from_domain: 'sleep',
        to_domain: 'mood',
        narrative: 'Shorter nights have been showing up beside heavier mood days.',
      },
    ],
    history: [],
    candidates: [],
  });
  assertEquals(layer.related.map((r) => r.text), ['This sits beside your mood.']);
  assertEquals(layer.related.some((r) => r.text.includes('40%')), false);
  assertEquals((layer.mattering ?? '').includes('heavier mood'), false);
  assertEquals((layer.evidence ?? '').includes('heavier mood'), false);
});

Deno.test('Why does not use a still learning placeholder as a chart', () => {
  const layer = composeWhyLayer({
    featured,
    todayNarrative: featured.narrative,
    todayPriority: { text: 'Keep protecting your sleep.', measured: true },
    understandings: [featured],
    relationships: [],
    crossDomain: [],
    history: [],
    candidates: [
      { ...viz('still_learning', 'Sleep'), kind: 'still-learning' },
      viz('rhr_line', 'Resting heart rate'),
    ],
    todayVizId: 'sleep_trend',
  });
  assertEquals(layer.primaryViz?.id, 'rhr_line');
});

Deno.test('whyAvailable is true when history, evidence, or a connection sits beyond Today', () => {
  assertEquals(
    whyAvailable({
      featured,
      todayNarrative: featured.narrative,
      todayPriority: {
        text: featured.guidance ?? '',
        measured: true,
      },
      understandings: [featured],
      relationships: [],
      crossDomain: [],
      history: [
        { understanding_id: featured.id, event_date: '2026-08-01', label: 'A sleep pattern started to show.' },
      ],
    }),
    true
  );
});

Deno.test('whyAvailable is false when Today already holds the whole story', () => {
  assertEquals(
    whyAvailable({
      featured: {
        ...featured,
        seeing: 'Not enough yet.',
        narrative: 'Not enough yet.',
        evidence_summary: 'Not enough yet.',
        baseline_summary: null,
        change_summary: null,
        related_domains: [],
        observations_count: 3,
        strength: 'emerging',
        guidance: 'Not enough yet.',
        still_learning: [],
      },
      todayNarrative: 'Not enough yet.',
      todayPriority: null,
      understandings: [featured],
      relationships: [],
      crossDomain: [],
      history: [],
    }),
    false
  );
});
