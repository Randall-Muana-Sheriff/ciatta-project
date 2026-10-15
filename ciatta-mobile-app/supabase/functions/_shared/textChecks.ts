// Reading numbers, doses and medication changes out of text, for checking
// what a model wrote. Pure; tested from the app's suite.

export const fold = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();
export const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A number standing on its own, not part of a name like T4, B12 or A1c.
const NUMBER = /(?<![A-Za-z0-9.,])\d{1,3}(?:,\d{3})+(?:\.\d+)?(?![A-Za-z0-9])|(?<![A-Za-z0-9.,])\d+(?:\.\d+)?(?![A-Za-z0-9])/g;
const NAMED_NUMBER = /(?<![A-Za-z0-9.])\d+(?:,\s*\d+)?\s*(?:hydroxy|dihydroxy|oh)\b/gi;
const glued = (text: string) => text.replace(/(?<![A-Za-z])(\d+(?:\.\d+)?)(?=[a-zA-Zµ%])/g, '$1 ');
const prepared = (text: string) => glued(text.replace(NAMED_NUMBER, ' '));
export const numbersIn = (text: string) => [...prepared(text).matchAll(NUMBER)].map((m) => Number(m[0].replace(/,/g, '')));

const DOSE_UNIT = '(?:mg|mcg|µg|iu|units?|g|grams?|milligrams?|micrograms?|international units|tablets?|capsules?|pills?|drops?|ml|millilit(?:er|re)s?|puffs?|sprays?|patch(?:es)?|teaspoons?|tablespoons?)';
// A dose written in words: "two tablets", "half a tablet".
const WORD_DOSE = new RegExp(`\\b(?:one|two|three|four|five|six|half(?:\\s+an?)?)\\s+${DOSE_UNIT}\\b`, 'gi');
const DOSE = new RegExp(`(?<![A-Za-z0-9.])\\d+(?:\\.\\d+)?\\s?${DOSE_UNIT}\\b(?!\\s*\\/\\s*(?:dl|l|ml|ul|µl|mmol|kg|m2)\\b)`, 'gi');
// Every dose written in a text, spaced the same way, for comparing.
export const doseMatches = (text: string) => [
  ...[...glued(text).matchAll(DOSE)].map((m) => fold(m[0].replace(/(\d)\s*([a-zµ])/i, '$1 $2'))),
  ...[...text.matchAll(WORD_DOSE)].map((m) => fold(m[0])),
];

// Each verb with its forms: stop, stops, stopped, stopping.
const VERB_STEMS = ['start', 'stop', 'begin', 'discontinue', 'increase', 'decrease', 'reduce', 'raise', 'double', 'halve', 'switch', 'pause', 'hold', 'taper', 'quit', 'resume', 'add', 'take', 'try', 'use', 'continue'];
const forms = (v: string) => {
  const last = v[v.length - 1];
  const doubled = /[aeiou][bdgmnprt]$/.test(v.slice(-2)) && v.length <= 4 ? v + last : v;
  const stem = v.endsWith('e') ? v.slice(0, -1) : v;
  return `${v}|${v}s|${v}es|${v}d|${stem}ed|${stem}ing|${doubled}ed|${doubled}ing|${v.endsWith('y') ? `${v.slice(0, -1)}ies|${v.slice(0, -1)}ied` : v}`;
};
const VERBS = `(?:${VERB_STEMS.map(forms).join('|')}|cut(?:ting)? back on|com(?:e|ing) off|consider(?:ing)? (?:increasing|decreasing|stopping|starting|switching|reducing))`;
// Stopping something named only as "it" or "them".
const PRONOUN_CHANGE = /\b(?:com(?:e|ing) off|stop(?:ping)?|quit(?:ting)?|discontinu(?:e|ing)|taper(?:ing)? off)\s+(?:it|them)\b/i;
const OBJECTS = '(?:medications?|medicines?|doses?|dosage|prescriptions?|pills?|tablets?|capsules?|supplements?|drugs?)';
const CHANGE_MED = new RegExp(`\\b${VERBS}\\s+(?:taking\\s+|using\\s+|your\\s+|the\\s+|an?\\s+|to\\s+)*(?:\\w+\\s+){0,2}${OBJECTS}\\b`, 'i');
const PASSIVE_MED = new RegExp(`\\b${OBJECTS}\\b[^.]{0,30}\\b(?:should|must|could|can|needs? to)\\s+be\\s+(?:stopped|started|increased|decreased|reduced|discontinued|paused|switched|held|tapered|changed|adjusted)\\b`, 'i');

// Whether a text tells her to start, stop or change a medication, in
// general words or by naming one of the given medications.
export function changesMedication(text: string, meds: string[]): boolean {
  if (CHANGE_MED.test(text) || PASSIVE_MED.test(text) || PRONOUN_CHANGE.test(text)) return true;
  return meds.filter(Boolean).some((med) => {
    const m = escape(med);
    return (
      new RegExp(`\\b${VERBS}\\b[^.]{0,30}\\b${m}\\b`, 'i').test(text) ||
      new RegExp(`\\b${m}\\b[^.]{0,30}\\b(?:should|must|could|can|needs? to)\\s+be\\s+\\w+ed\\b`, 'i').test(text)
    );
  });
}

export const URGENT_WORDS = /\b(urgent|urgently|critical|emergency|call 911|immediately|stat|seek (?:immediate|emergency) care)\b/i;

// The medications a text names, from a list.
export const medsNamed = (text: string, meds: string[]) => meds.filter((m) => m && new RegExp(`\\b${escape(m)}\\b`, 'i').test(text));
