// What Care shows while it works: the steps this answer actually took, in
// order, then the answer written out a few words at a time. Nothing here is
// theatre: each step names a source the answer was built from, and the last
// is the check every answer passes before she sees it.

import type { Answer } from './types';

export function progressSteps(a: Pick<Answer, 'capability' | 'facts' | 'abstained'>): string[] {
  const steps = ['Reading your question'];
  // A warning sign is answered at once; she should not wait on it.
  if (a.capability === 'escalate') return steps;
  if (a.abstained || !a.facts.length) return [...steps, 'Looking through your record'];
  const from = new Set(a.facts.map((f) => f.from));
  if (a.capability === 'labs') steps.push('Checking your labs');
  else if (a.capability === 'clinical') steps.push('Reading what your providers sent');
  else {
    if (from.has('reported')) steps.push('Reading your logs');
    if (from.has('measured')) steps.push('Reading your devices');
  }
  if (from.has('derived')) steps.push('Comparing with your usual');
  if (from.has('reference')) steps.push('Checking reviewed sources');
  steps.push('Checking every figure against your record');
  return steps;
}

// The first n words of the answer, as it is written out.
export function revealWords(text: string, n: number): string {
  const words = text.split(' ');
  return n >= words.length ? text : words.slice(0, n).join(' ');
}
