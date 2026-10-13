// Logging in one sentence.
//
// There were two logging experiences and they disagreed. The plus opened a
// menu of three screens; one of them was a fifteen step questionnaire that
// led with "What happened?" and a wall of chips, and the box she actually
// writes in sat at the bottom of every step. So the fastest way to record
// a period was: plus, pick a screen, pick chips, next, next, next, review,
// save. For a thing she wants to log in four seconds, standing up.
//
// This inverts it. The box leads. A category says what the log is mostly
// about, the placeholder shows what a sentence looks like, and send saves
// it. One sentence may name several categories, and planSave below files
// each part where the record already keeps it. The questionnaire is still
// there, behind one link, for the episode worth describing properly.
//
// What this module does is read that sentence for the vocabulary the rest
// of the app already uses, so a quick log is a real entry rather than a
// loose string. Two rules hold it honest:
//
//   Only words that are present. Every cue below matches something she
//   actually wrote. Nothing is inferred from absence, from the date, or
//   from anything a device reported.
//
//   Everything found is shown back to her before she sends. The screen
//   prints what was recognised, so nothing is stored that she did not see
//   stored. That is why these are reported, never measured.

import type { EntryKind } from '../data/sample';
import type { Attachment } from './attachments';
import { BOWEL, category, type CategoryKey } from './logCategories';
import { readNote } from './readNote';

// Cues for the kinds in WHAT_HAPPENED. Every one of these is a word she
// wrote, mapped to the label the record already uses for it, so a sentence
// becomes the same kind of entry the chips would have made.
//
// 'Other' is deliberately absent: it is a label for a thing she names
// herself, and guessing it from text would mean guessing.
const KIND_CUES: [RegExp, string][] = [
  [/\b(period|menstruat\w*|bleeding|bled)\b/i, 'Period'],
  [/\bspott?ing\b/i, 'Spotting'],
  [/\b(pain|painful|cramp\w*|ache|aching|aches|sore|hurts?|hurting)\b/i, 'Pain'],
  [/\b(stool|poop|pooped|bowel|diarrh\w*|constipat\w*)\b/i, 'Bowel movement'],
];

// The kinds her words name, in the order the record lists them.
export function readKinds(text: string): string[] {
  if (!text.trim()) return [];
  const found: string[] = [];
  for (const [cue, label] of KIND_CUES) {
    if (cue.test(text) && !found.includes(label)) found.push(label);
  }
  return found;
}

// Flow, but only when she said it in those words. A period with no adjective
// has no flow, and 'Moderate' is not a safe default: it would be Ciatta
// filling in a value and calling it hers.
const FLOW_CUES: [RegExp, string][] = [
  [/\bvery heavy\b/i, 'Very heavy'],
  [/\b(heavy|heavier|flooding)\b/i, 'Heavy'],
  [/\b(light|lighter|barely)\b/i, 'Light'],
  [/\bmoderate\b/i, 'Moderate'],
  [/\b(variable|on and off)\b/i, 'Variable'],
];

export function readFlow(text: string): string | null {
  if (!text.trim()) return null;
  for (const [cue, label] of FLOW_CUES) {
    if (cue.test(text)) return label;
  }
  return null;
}

// Yesterday, or a count of days, when she said so. Anything vaguer than
// this stays today, because the sentence is what it is: a log written now.
export function readDaysAgo(text: string): number {
  if (/\byesterday\b/i.test(text)) return 1;
  const named = /\b(\d{1,2}) days? ago\b/i.exec(text);
  if (named) {
    const n = Number(named[1]);
    if (Number.isFinite(n) && n > 0 && n <= 60) return n;
  }
  if (/\blast week\b/i.test(text)) return 7;
  return 0;
}

// What a sentence names, by category. Each cue maps a word she wrote to a
// chip that already exists in that category, so a sentence and a tap make
// the same entry. Order inside a category is the chip order.
export type Found = Partial<Record<CategoryKey, string[]>>;

// Phrases read before any single word, and removed once read, so a word
// inside them cannot be read again on its own. "Bleeding after sex" is
// sexual health and must never start a period; "joint pain" is the joint
// chip, not a second, generic pain. A null item means the phrase is
// recognised only to be set aside: "sore throat" is not pelvic pain and
// "period leaked" is not urinary leaking.
const PHRASES: [RegExp, CategoryKey | null, string | null][] = [
  [/\bbleeding after sex\b/gi, 'sexual', 'Bleeding after sex'],
  [/\bpain(ful)? (with|during) sex\b|\bpainful sex\b/gi, 'sexual', 'Pain with sex'],
  [/\b(vaginal dryness|dryness down there)\b/gi, 'sexual', 'Vaginal dryness'],
  [/\bburn\w* when (i )?pee\w*/gi, 'sexual', 'Burning when peeing'],
  [/\b(tender|sore) breasts?\b|\bbreast (tenderness|pain)\b/gi, 'body', 'Breast tenderness'],
  [/\bjoint (pain|aches?)\b/gi, 'body', 'Joint pain'],
  [/\bhot flash(es)?\b/gi, 'body', 'Hot flashes'],
  [/\bnight sweats?\b/gi, 'body', 'Night sweats'],
  [/\bmood swings?\b/gi, 'mind', 'Mood swings'],
  [/\bdry skin\b/gi, 'skin', 'Dry skin'],
  [/\b(nose ?bleed\w*|bleeding gums|gums bleed\w*)\b/gi, null, null],
  [/\bsore (throat|eyes?|feet|muscles from the gym)\b/gi, null, null],
  [/\b(period|pad|tampon|cup|disc) leak\w*/gi, null, null],
  [/\b(run|wind|calm|slow) down\b|\brun ?down\b/gi, null, null],
  [/\bgas station\b|\bon the pill\b/gi, null, null],
];

// Single cues, read from what the phrases left. Each maps a word she wrote
// to a chip that already exists in that category, so a sentence and a tap
// make the same entry. Words with an everyday second meaning need context:
// "gassy", not "gas"; "feeling down", not "down".
const CUES: [RegExp, CategoryKey, string][] = [
  [/\b(period|menstruat\w*|bleeding|bled)\b/i, 'cycle', 'Period'],
  [/\bspott?ing\b/i, 'cycle', 'Spotting'],
  [/\b(coffees?|espresso|lattes?|caffeine|energy drinks?|cola)\b/i, 'nutrition', 'Caffeine'],
  [/\b(wine|beers?|alcohol|cocktails?|drinks? (last night|after work)|gin|vodka|prosecco)\b/i, 'nutrition', 'Alcohol'],
  [/\bskipped (breakfast|lunch|dinner|a meal|meals)\b|\bdid not eat\b|\bdidn.t eat\b/i, 'nutrition', 'Skipped a meal'],
  [/\b(late dinner|ate late|eating late|midnight snack)\b/i, 'nutrition', 'Ate late'],
  [/\bbloat\w*/i, 'gut', 'Bloating'],
  [/\bcramp\w*/i, 'gut', 'Cramping'],
  [/\b(nausea|nauseous|queasy)\b/i, 'gut', 'Nausea'],
  [/\b(reflux|heartburn)\b/i, 'gut', 'Reflux'],
  [/\b(gassy|gas pain|trapped gas|(lots of|so much|bad) gas|flatulen\w*)\b/i, 'gut', 'Gas'],
  [/\bconstipat\w*/i, 'gut', 'Constipation'],
  [/\b(loose (stools?|bowels?|poo|poop)|diarrh\w*)\b/i, 'gut', 'Loose'],
  [/\b(stool|poop|pooped|bowel)\b/i, 'gut', BOWEL],
  [/\b(pain|painful|ache|aching|aches|sore|hurts?|hurting)\b/i, 'body', 'Pain'],
  [/\b(fatigue|fatigued|exhausted|tired)\b/i, 'body', 'Fatigue'],
  [/\bchills?\b/i, 'body', 'Chills'],
  [/\b(swollen|swelling|puffy)\b/i, 'body', 'Swelling'],
  [/\b(fog|foggy|brain fog)\b/i, 'mind', 'Brain fog'],
  [/\b(forgetful|forgot|memory)\b/i, 'mind', 'Memory lapses'],
  [/\b(focus|concentrat\w*)\b/i, 'mind', 'Hard to focus'],
  [/\bheadache\b/i, 'mind', 'Headache'],
  [/\bmigraine\b/i, 'mind', 'Migraine'],
  [/\b(dizzy|dizziness|lightheaded)\b/i, 'mind', 'Dizziness'],
  [/\b(tingl\w*|numb\w*|pins and needles)\b/i, 'mind', 'Tingling or numbness'],
  [/\b(low mood|sad|teary|(feeling|feel|felt) (low|down))\b/i, 'mind', 'Low mood'],
  [/\b(anxious|anxiety|panick?y)\b/i, 'mind', 'Anxiety'],
  [/\b(irritable|irritated|snappy)\b/i, 'mind', 'Irritability'],
  [/\b(acne|breakout|broke out|spots|pimples?)\b/i, 'skin', 'Acne'],
  [/\boily (skin|face)\b|\bskin (is|was) oily\b/i, 'skin', 'Oily skin'],
  [/\b(hair (shedding|loss|falling)|more hair in)\b/i, 'skin', 'Hair shedding'],
  [/\b(chin hair|facial hair|unwanted hair)\b/i, 'skin', 'Unwanted hair growth'],
  [/\b(dark patch\w*|pigment\w*)\b/i, 'skin', 'Dark patches'],
  [/\b(itch\w*)\b/i, 'skin', 'Itching'],
  [/\b(low libido|no sex drive|low sex drive)\b/i, 'sexual', 'Low libido'],
  [/\bdischarge\b/i, 'sexual', 'Discharge change'],
  [/\b(urgency|pee more|peeing more|need to pee)\b/i, 'sexual', 'Urinary urgency'],
  [/\b(leak|leaking|leaked)\b/i, 'sexual', 'Leaking'],
  [/\b(slept badly|bad sleep|poor sleep|could not sleep|couldn.t sleep)\b/i, 'context', 'Slept badly'],
  [/\b(slept well|good sleep)\b/i, 'context', 'Slept well'],
  [/\b(exercised|workout|worked out|gym|yoga|walked|jog\w*|went for a run|ran \d)\b/i, 'context', 'Exercised'],
  [/\b(stressful|stressed)\b/i, 'context', 'Stressful event'],
  [/\b(flight|flew|travel\w*|trip)\b/i, 'context', 'Travel'],
  [/\b(ibuprofen|paracetamol|tylenol|advil|painkillers?|medication|meds|took (a|my) pill)\b/i, 'context', 'Took medication'],
  [/\b(supplement|vitamin|magnesium|iron tablets?)\b/i, 'context', 'Took supplement'],
  [/\b(sick|ill|a cold|flu|fever)\b/i, 'context', 'Illness'],
  [/\b(damp|mou?ld|mouldy|moldy|mildew)\b/i, 'context', 'Damp or mould at home'],
];

// "No pain today", "not bloated": what she says she does not have is set
// aside before anything is read, one word after the negation at most.
const NEGATED = /\b(no|not|without|never|zero)\s+(?:\w+\s+)?\w+/gi;

const add = (found: Found, key: CategoryKey, item: string) => {
  const list = (found[key] ??= []);
  if (!list.includes(item)) list.push(item);
};

export function readCategories(text: string): Found {
  const found: Found = {};
  if (!text.trim()) return found;
  let rest = text.replace(NEGATED, ' ');
  for (const [phrase, key, item] of PHRASES) {
    if (!phrase.test(rest)) continue;
    phrase.lastIndex = 0;
    if (key && item) add(found, key, item);
    rest = rest.replace(phrase, ' ');
  }
  for (const [cue, key, item] of CUES) {
    if (cue.test(rest)) add(found, key, item);
  }
  // Cramps alongside a period are period pain, not a gut flag: the engine
  // reads digestion for food and bloating, and filing her cramps there
  // would put her period in her gut.
  if (found.cycle?.length && found.gut?.includes('Cramping')) {
    found.gut = found.gut.filter((x) => x !== 'Cramping');
    if (!found.gut.length) delete found.gut;
    add(found, 'body', 'Pain');
  }
  // Keep each category in its chip order, whatever order the reads ran in.
  for (const key of Object.keys(found) as CategoryKey[]) {
    const order = category(key).quick;
    found[key]!.sort((x, y) => order.indexOf(x) - order.indexOf(y));
  }
  return found;
}

export function mergeFound(a: Found, b: Found): Found {
  const out: Found = {};
  for (const src of [a, b]) {
    for (const [key, items] of Object.entries(src) as [CategoryKey, string[]][]) {
      const list = (out[key] ??= []);
      for (const item of items) if (!list.includes(item)) list.push(item);
    }
  }
  return out;
}

export type QuickReading = { kinds: string[]; context: string[]; flow: string | null; daysAgo: number; found: Found };

export function readQuick(text: string): QuickReading {
  return {
    kinds: readKinds(text),
    context: readNote(text),
    flow: readFlow(text),
    daysAgo: readDaysAgo(text),
    found: readCategories(text),
  };
}

const ORDER: CategoryKey[] = ['cycle', 'nutrition', 'gut', 'body', 'mind', 'skin', 'sexual', 'context'];

// What was recognised, grouped as it will be filed. Null when nothing was,
// so no empty label is drawn; the words still save.
export function readingLine(found: Found, flow: string | null, daysAgo: number): string | null {
  const groups: string[] = [];
  for (const key of ORDER) {
    const items = [...(found[key] ?? [])];
    if (key === 'cycle') {
      if (flow) items.push(`${flow} flow`);
      if (items.length && daysAgo === 1) items.push('yesterday');
      else if (items.length && daysAgo > 1) items.push(`${daysAgo} days ago`);
    }
    if (items.length) groups.push(`${category(key).label}: ${items.join(', ')}`);
  }
  return groups.length ? groups.join(' · ') : null;
}

// Where each part of one log goes. Storage is what already exists:
//
//   Cycle items, Pain and Bowel movement are episodes, because the body
//   map, cycle patterns and the cycle lens read them there.
//   Gut flags are the day's digestion list in daily_metrics, which the
//   engine's food and bloating check already reads.
//   Everything else is one journal entry carrying its category and items.
//
// Her words and files are saved once: on the journal entry when there is
// one, else on the episode, else on the day.
export type SavePlan = {
  episode: { kinds: string[]; flow: string | null; daysAgo: number; context: string[] } | null;
  daily: { digestion: string[] } | null;
  journal: { kind: EntryKind; category: CategoryKey; items: Found } | null;
  wordsGoTo: 'journal' | 'episode' | 'daily';
  // How many days back she said this was. Dates every part, not only the
  // episode.
  daysAgo: number;
};

const JOURNAL_KEYS: CategoryKey[] = ['nutrition', 'body', 'mind', 'skin', 'sexual', 'context'];

export function planSave(input: { text: string; selected: CategoryKey; tapped: string[]; files: Attachment[] }): SavePlan | null {
  const text = input.text.trim();
  const found = mergeFound(readCategories(text), input.tapped.length ? { [input.selected]: input.tapped } : {});
  if (!text && !input.files.length && !Object.keys(found).length) return null;
  // Cramps she logs from Cycle or Body are pain where she feels it, not a
  // gut flag, whatever else the sentence says.
  if ((input.selected === 'cycle' || input.selected === 'body') && found.gut?.includes('Cramping')) {
    found.gut = found.gut.filter((x) => x !== 'Cramping');
    if (!found.gut.length) delete found.gut;
    found.body = [...new Set(['Pain', ...(found.body ?? [])])];
  }

  const kinds = [
    ...(found.cycle ?? []),
    ...(found.body?.includes('Pain') ? ['Pain'] : []),
    ...(found.gut?.includes(BOWEL) ? [BOWEL] : []),
  ];
  const digestion = (found.gut ?? []).filter((x) => x !== BOWEL);

  const items: Found = {};
  for (const key of JOURNAL_KEYS) {
    const list = (found[key] ?? []).filter((x) => !(key === 'body' && x === 'Pain'));
    if (list.length) items[key] = list;
  }
  const hasWords = !!text || input.files.length > 0;
  // A file needs a home she can open again. The day's row keeps no files
  // she can see, so files beside gut flags alone become a journal entry.
  const wantsJournal =
    Object.keys(items).length > 0 ||
    input.selected === 'note' ||
    (hasWords && !kinds.length && !digestion.length) ||
    (input.files.length > 0 && !kinds.length);
  // An episode only when there is a kind to file: words with nothing
  // recognised are a note, filed under the category she chose, never an
  // empty cycle entry.
  const wantsEpisode = kinds.length > 0;

  const journalCategory: CategoryKey =
    (JOURNAL_KEYS as CategoryKey[]).includes(input.selected) || input.selected === 'note'
      ? input.selected
      : ((Object.keys(items)[0] as CategoryKey | undefined) ?? input.selected);

  return {
    episode: wantsEpisode
      ? { kinds, flow: readFlow(text), daysAgo: readDaysAgo(text), context: readNote(text) }
      : null,
    daily: digestion.length ? { digestion } : null,
    journal: wantsJournal ? { kind: category(journalCategory).journalKind, category: journalCategory, items } : null,
    wordsGoTo: wantsJournal ? 'journal' : wantsEpisode ? 'episode' : 'daily',
    daysAgo: readDaysAgo(text),
  };
}

// Carrying out a plan, safely retried. The server writes go first and the
// local episode last, so a failure partway adds nothing she would see
// twice; and a step that already landed is never run again on retry,
// because `done` lives as long as the compose does, not the attempt.
export type SaveSteps = {
  daily?: () => Promise<void>;
  journal?: () => Promise<void>;
  episode?: () => void;
};

export async function runSave(steps: SaveSteps, done: Set<string>): Promise<void> {
  for (const key of ['daily', 'journal', 'episode'] as const) {
    const step = steps[key];
    if (!step || done.has(key)) continue;
    await step();
    done.add(key);
  }
}
