/**
 * The quiz: what it may ask, and how it decides what to ask next.
 *
 * WHAT THIS IS NOT.
 *
 * It is not a diagnosis, a score, a likelihood band, or a condition named in
 * any form. The quiz this was modelled on ends on "Low Likelihood — your
 * answers indicate a low likelihood of having endometriosis". Ciatta cannot
 * end there: the site's own FAQ says naming a condition is a clinician's job
 * and that Ciatta "does not do it, suggest it, or hint at it", and the footer
 * of every page says it does not diagnose, treat or prevent. So the ending is
 * hers — what she just said, sorted into what is worth raising first and what
 * is worth mentioning, in words she can say out loud in an appointment.
 *
 * It is also not an AI, and it must never be described as one. Everything
 * below is a rule you can read. That matters more here than anywhere else on
 * the site: a health question that changes based on your answers should be
 * something you can check, not something you have to trust.
 *
 * HOW IT DECIDES WHAT TO ASK NEXT.
 *
 * The old quiz was twelve questions in a fixed order, asked in full whatever
 * anyone said. Someone whose periods are fine still answered four questions
 * about them; someone who said the pain stops her working was never asked
 * what happens when she takes something for it. Both are the same failure:
 * the questions did not listen.
 *
 * So each question carries what it opens. Answer at the top of the scale and
 * the questions that follow from that answer are queued ahead of everything
 * else; answer at the bottom and they are never asked. Some answers close
 * questions outright — say sex does not apply to you and you are not asked
 * about it again.
 *
 * The order, on every turn:
 *
 *   1. Anything a strong answer opened, strongest first.
 *   2. Otherwise the next screening question for the track, in bank order.
 *   3. Stop at the cap, or when nothing is left, or early: if the first four
 *      screeners all came back at the bottom of the scale and nothing was
 *      opened, there is nothing here to keep digging for, and asking six more
 *      questions to arrive at "nothing stood out" wastes her time.
 *
 * That is the whole of it. No model, no scoring, no threshold, no band.
 *
 * EVERY QUESTION EARNS ITS PLACE IN THE RESULT. There are no questions here
 * about whether she keeps a record, or what she uses, or how she found us.
 * The result is a page she takes to a clinician, so a question that cannot
 * appear on that page is a question this quiz does not ask.
 */

/** How much an answer is worth raising. Never how likely anything is. */
export type Weight = 0 | 1 | 2;

export type Answer = {
  label: string;
  w: Weight;
  /** Asked next, ahead of the screeners, when this answer is chosen. */
  opens?: string[];
  /** Never asked once this answer is chosen. */
  closes?: string[];
};

export type Track =
  | 'cycle' | 'pain' | 'sleep' | 'labs' | 'treatment' | 'prepare';

export type Question = {
  id: string;
  /** Which tracks screen with this question. Follow-ups may list none.
      THE FIRST ONE IS ITS HOME TRACK, and that is not decoration: a track
      asks its own questions before it borrows anybody else's. Without it,
      "Something changed and I cannot name it" opened on a question about
      tiredness, purely because the sleep questions sit higher in the bank. */
  tracks: Track[];
  /** What it is about, in the words the result uses. */
  domain: string;
  q: string;
  /** Three, least to most. Never more: a scale you have to read twice is
      not a scale, and five options is a survey. */
  a: [Answer, Answer, Answer];
  /** A screener is asked in bank order; a follow-up only when opened. */
  kind: 'screen' | 'follow';
};

/* -------------------------------------------------------------------------
   THE TRACKS
   -------------------------------------------------------------------------
   Six ways in, named for what she arrived with rather than for a body
   system. "Hormones & cycle" is a category on a website; "My cycle or my
   periods have changed" is the sentence she would actually say.

   The last one is for the largest group of all: people who know something is
   wrong and cannot name which box it goes in. It is not a lesser path, and
   it is not labelled as one.
   ------------------------------------------------------------------------- */

export type TrackInfo = { key: Track; label: string; line: string; head: string };

export const TRACKS: TrackInfo[] = [
  { key: 'cycle',
    label: 'My cycle or my periods',
    line: 'Length, heaviness, or pain that comes with them.',
    head: 'About your cycle' },
  { key: 'pain',
    label: 'Pain that keeps coming back',
    line: 'Where it is, how bad it gets, and whether anything settles it.',
    head: 'About the pain' },
  { key: 'sleep',
    label: 'Sleep and energy',
    line: 'Getting to sleep, staying asleep, and being tired anyway.',
    head: 'About your sleep and energy' },
  { key: 'labs',
    label: 'Results I was told were normal',
    line: 'Still feeling unwell after being told nothing was found.',
    head: 'About how you have been feeling' },
  { key: 'treatment',
    label: 'A treatment I am not sure about',
    line: 'Whether it is working, and what it has changed.',
    head: 'About your treatment' },
  { key: 'prepare',
    label: 'Something changed and I cannot name it',
    line: 'Start here and we will work out what to write down.',
    head: 'About what changed' },
];

/* -------------------------------------------------------------------------
   THE QUESTIONS
   -------------------------------------------------------------------------
   Second person, plain words, three answers from least to most. Nothing here
   asks her to interpret anything: every question is about what happened, how
   often, and how bad, because those are the three things a clinician can use
   and the three things she is least likely to recall on the day.
   ------------------------------------------------------------------------- */

export const BANK: Question[] = [
  /* ---- cycle ----------------------------------------------------------- */
  { id: 'cyc-pain', kind: 'screen', tracks: ['cycle', 'pain'],
    domain: 'Period pain',
    q: 'How would you describe your period pain?',
    a: [
      { label: 'Uncomfortable, but nothing I would call painful', w: 0 },
      { label: 'Painful, though over-the-counter painkillers handle it', w: 1 },
      { label: 'Bad enough that I cannot work or do my usual day', w: 2,
        opens: ['pain-relief', 'pain-days'] },
    ] },

  { id: 'cyc-heavy', kind: 'screen', tracks: ['cycle'],
    domain: 'How heavy your periods are',
    q: 'Are your periods heavy?',
    a: [
      { label: 'No, ordinary protection is enough', w: 0, closes: ['cyc-products', 'cyc-through'] },
      { label: 'Sometimes heavy enough to need changing more often', w: 1,
        opens: ['cyc-products'] },
      { label: 'Almost always heavy, and I plan around it', w: 2,
        opens: ['cyc-products', 'cyc-through'] },
    ] },

  { id: 'cyc-length', kind: 'screen', tracks: ['cycle'],
    domain: 'How long your periods last',
    q: 'How long does your period usually last?',
    a: [
      { label: 'Around five days or fewer', w: 0 },
      { label: 'Six or seven days', w: 1 },
      { label: 'More than seven days, or it is hard to say where it ends', w: 2 },
    ] },

  { id: 'cyc-change', kind: 'screen', tracks: ['cycle'],
    domain: 'Whether your cycle has changed',
    q: 'Has the length of your cycle changed over the last year?',
    a: [
      { label: 'No, it is about what it has always been', w: 0 },
      { label: 'A little, or it varies more than it used to', w: 1 },
      { label: 'Yes, noticeably shorter or longer', w: 2 },
    ] },

  { id: 'cyc-between', kind: 'screen', tracks: ['cycle', 'pain'],
    domain: 'Pain between periods',
    q: 'Do you get pelvic pain when you are not on your period?',
    a: [
      { label: 'Rarely or never', w: 0 },
      { label: 'Sometimes, around ovulation or before my period', w: 1 },
      { label: 'Often, at any point in the month', w: 2, opens: ['pain-sex', 'pain-bowel'] },
    ] },

  { id: 'cyc-products', kind: 'follow', tracks: [],
    domain: 'What your heaviest days need',
    q: 'On your heaviest days, what are you using?',
    a: [
      { label: 'Regular pads or tampons are enough', w: 0 },
      { label: 'Super or overnight on the worst days', w: 1 },
      { label: 'Overnight pads and super tampons, changed every couple of hours', w: 2 },
    ] },

  { id: 'cyc-through', kind: 'follow', tracks: [],
    domain: 'Bleeding through',
    q: 'Do you ever bleed through in the night, or through your clothes?',
    a: [
      { label: 'No', w: 0 },
      { label: 'Occasionally', w: 1 },
      { label: 'Most cycles, and I plan around it', w: 2 },
    ] },

  /* ---- pain ------------------------------------------------------------ */
  { id: 'pain-bad', kind: 'screen', tracks: ['pain'],
    domain: 'How bad the pain gets',
    q: 'At its worst, how bad does the pain get?',
    a: [
      { label: 'Noticeable, but I carry on', w: 0 },
      { label: 'Bad enough that I take something for it', w: 1, opens: ['pain-relief'] },
      { label: 'Bad enough that I stop what I am doing', w: 2,
        opens: ['pain-relief', 'pain-days', 'pain-stronger'] },
    ] },

  { id: 'pain-often', kind: 'screen', tracks: ['pain'],
    domain: 'How often you are in pain',
    q: 'How often are you in pain?',
    a: [
      { label: 'A few days a month', w: 0 },
      { label: 'Most weeks', w: 1 },
      { label: 'Most days', w: 2 },
    ] },

  { id: 'pain-spread', kind: 'screen', tracks: ['pain'],
    domain: 'Whether the pain has spread',
    q: 'Has the pain spread or moved since it started?',
    a: [
      { label: 'No, it is where it has always been', w: 0 },
      { label: 'A little', w: 1 },
      { label: 'Yes, it turns up in places it did not before', w: 2 },
    ] },

  { id: 'pain-sex', kind: 'screen', tracks: ['pain'],
    domain: 'Pain during or after sex',
    q: 'Do you get pain during or after sex?',
    a: [
      { label: 'No, or this does not apply to me', w: 0 },
      { label: 'Sometimes', w: 1 },
      { label: 'Often, and it has changed what I do', w: 2 },
    ] },

  { id: 'pain-bowel', kind: 'screen', tracks: ['pain'],
    domain: 'Pain emptying your bowels or bladder',
    q: 'Do you get pain or urgency when you empty your bowels or bladder?',
    a: [
      { label: 'No', w: 0 },
      { label: 'Occasionally, usually during my period', w: 1 },
      { label: 'Often, period or not', w: 2 },
    ] },

  { id: 'pain-gut', kind: 'screen', tracks: ['pain'],
    domain: 'Digestive symptoms',
    q: 'How often do you get bloating, nausea, constipation or diarrhoea?',
    a: [
      { label: 'Rarely', w: 0 },
      { label: 'Sometimes, often around my period', w: 1 },
      { label: 'Most of the time', w: 2 },
    ] },

  { id: 'pain-relief', kind: 'follow', tracks: [],
    domain: 'Whether pain relief works',
    q: 'When you take something for the pain, does it help?',
    a: [
      { label: 'Yes, it settles', w: 0 },
      { label: 'Somewhat, or it comes back', w: 1 },
      { label: 'Not really, whatever I take', w: 2, opens: ['pain-stronger'] },
    ] },

  { id: 'pain-days', kind: 'follow', tracks: [],
    domain: 'Days the pain takes from you',
    q: 'How many days a month does pain stop you doing something?',
    a: [
      { label: 'One or two', w: 0 },
      { label: 'Three to five', w: 1 },
      { label: 'More than five', w: 2 },
    ] },

  { id: 'pain-stronger', kind: 'follow', tracks: [],
    domain: 'What you have been prescribed for it',
    q: 'Have you been prescribed anything stronger for the pain?',
    a: [
      { label: 'No, over the counter is all I use', w: 0 },
      { label: 'Yes, and it helps', w: 1 },
      { label: 'Yes, and it still does not settle it', w: 2 },
    ] },

  /* ---- sleep and energy ------------------------------------------------ */
  { id: 'slp-fall', kind: 'screen', tracks: ['sleep'],
    domain: 'Getting to sleep',
    q: 'How easily do you get to sleep?',
    a: [
      { label: 'Usually within twenty minutes', w: 0 },
      { label: 'Some nights it takes a while', w: 1 },
      { label: 'Most nights I lie awake', w: 2 },
    ] },

  { id: 'slp-wake', kind: 'screen', tracks: ['sleep'],
    domain: 'Waking in the night',
    q: 'Do you wake in the night?',
    a: [
      { label: 'Rarely', w: 0, closes: ['slp-pain'] },
      { label: 'Once most nights', w: 1 },
      { label: 'Several times most nights', w: 2, opens: ['slp-pain'] },
    ] },

  { id: 'slp-hours', kind: 'screen', tracks: ['sleep'],
    domain: 'How much sleep you get',
    q: 'On a usual night, how much sleep do you get?',
    a: [
      { label: 'Seven hours or more', w: 0 },
      { label: 'Six to seven hours', w: 1 },
      { label: 'Under six hours', w: 2 },
    ] },

  { id: 'slp-rest', kind: 'screen', tracks: ['sleep', 'labs', 'prepare'],
    domain: 'Fatigue',
    q: 'How often are you tired in a way that rest does not fix?',
    a: [
      { label: 'Rarely', w: 0 },
      { label: 'Some weeks, usually around my period', w: 1 },
      { label: 'Most weeks', w: 2, opens: ['slp-day'] },
    ] },

  { id: 'slp-change', kind: 'screen', tracks: ['sleep'],
    domain: 'Whether your sleep has changed',
    q: 'Has your sleep changed over the last few months?',
    a: [
      { label: 'No', w: 0 },
      { label: 'A little', w: 1 },
      { label: 'Yes, noticeably', w: 2 },
    ] },

  { id: 'slp-pain', kind: 'follow', tracks: [],
    domain: 'Being woken by pain',
    q: 'Does pain wake you?',
    a: [
      { label: 'No', w: 0 },
      { label: 'Occasionally', w: 1 },
      { label: 'Most weeks', w: 2 },
    ] },

  { id: 'slp-day', kind: 'follow', tracks: [],
    domain: 'What tiredness costs you',
    q: 'Has tiredness changed what you do in a day?',
    a: [
      { label: 'No', w: 0 },
      { label: 'Occasionally', w: 1 },
      { label: 'Regularly, and I plan around it', w: 2 },
    ] },

  /* ---- told it was normal ---------------------------------------------- */
  { id: 'lab-told', kind: 'screen', tracks: ['labs'],
    domain: 'Being told nothing was found',
    q: 'Have you been told your results are normal while still feeling unwell?',
    a: [
      { label: 'No', w: 0 },
      { label: 'Once', w: 1 },
      { label: 'More than once', w: 2, opens: ['lab-again', 'lab-worse'] },
    ] },

  { id: 'lab-much', kind: 'screen', tracks: ['labs'],
    domain: 'How much it affects your day',
    q: 'How much is it affecting your day?',
    a: [
      { label: 'A little', w: 0 },
      { label: 'Some days', w: 1 },
      { label: 'Most days', w: 2 },
    ] },

  { id: 'lab-body', kind: 'screen', tracks: ['labs'],
    domain: 'Changes in hair, skin or nails',
    q: 'Have you noticed changes in your hair, skin or nails?',
    a: [
      { label: 'No', w: 0 },
      { label: 'Some', w: 1 },
      { label: 'Noticeable ones', w: 2 },
    ] },

  { id: 'lab-weight', kind: 'screen', tracks: ['labs'],
    domain: 'Weight changing on its own',
    q: 'Has your weight changed without you changing anything?',
    a: [
      { label: 'No', w: 0 },
      { label: 'A little', w: 1 },
      { label: 'Noticeably', w: 2 },
    ] },

  { id: 'lab-cold', kind: 'screen', tracks: ['labs'],
    domain: 'Feeling the cold',
    q: 'Do you feel the cold more than you used to?',
    a: [
      { label: 'No', w: 0 },
      { label: 'Sometimes', w: 1 },
      { label: 'Often', w: 2 },
    ] },

  { id: 'lab-focus', kind: 'screen', tracks: ['labs', 'prepare'],
    domain: 'Concentration and memory',
    q: 'How is your concentration or memory?',
    a: [
      { label: 'As it has always been', w: 0 },
      { label: 'Patchy on some days', w: 1 },
      { label: 'Noticeably worse than it was', w: 2 },
    ] },

  { id: 'lab-again', kind: 'follow', tracks: [],
    domain: 'Whether it has been measured more than once',
    q: 'Has the same thing been measured more than once, so you can see it over time?',
    a: [
      { label: 'Yes, several times', w: 0 },
      { label: 'Once or twice', w: 1 },
      { label: 'I am not sure, or I have never seen the numbers', w: 2 },
    ] },

  { id: 'lab-worse', kind: 'follow', tracks: [],
    domain: 'Whether it is getting worse',
    q: 'Since you were told nothing was found, how are you?',
    a: [
      { label: 'Better', w: 0 },
      { label: 'About the same', w: 1 },
      { label: 'Worse', w: 2 },
    ] },

  /* ---- a treatment ------------------------------------------------------ */
  { id: 'tx-change', kind: 'screen', tracks: ['treatment'],
    domain: 'Whether the treatment has changed anything',
    q: 'Since you started it, has anything changed?',
    a: [
      { label: 'Yes, things are better', w: 0 },
      { label: 'Hard to tell', w: 1, opens: ['tx-before'] },
      { label: 'No, or things are worse', w: 2, opens: ['tx-before', 'tx-ask'] },
    ] },

  { id: 'tx-side', kind: 'screen', tracks: ['treatment'],
    domain: 'Side effects',
    q: 'Have you had side effects?',
    a: [
      { label: 'None I have noticed', w: 0, closes: ['tx-skip'] },
      { label: 'Some, but manageable', w: 1 },
      { label: 'Enough that I have thought about stopping', w: 2, opens: ['tx-skip'] },
    ] },

  { id: 'tx-dose', kind: 'screen', tracks: ['treatment'],
    domain: 'Dose changes',
    q: 'Has the dose changed since you started?',
    a: [
      { label: 'No', w: 0 },
      { label: 'Once', w: 1 },
      { label: 'More than once', w: 2 },
    ] },

  { id: 'tx-before', kind: 'follow', tracks: [],
    domain: 'What you were like before it',
    q: 'Could you say what you were like in the month before you started?',
    a: [
      { label: 'Yes, I have it written down', w: 0 },
      { label: 'Roughly', w: 1 },
      { label: 'Not really', w: 2 },
    ] },

  { id: 'tx-skip', kind: 'follow', tracks: [],
    domain: 'Doses you have skipped',
    q: 'Have you stopped or skipped doses because of how it makes you feel?',
    a: [
      { label: 'No', w: 0 },
      { label: 'Occasionally', w: 1 },
      { label: 'Often', w: 2 },
    ] },

  { id: 'tx-ask', kind: 'follow', tracks: [],
    domain: 'Getting an answer about it',
    q: 'Have you been able to ask about it?',
    a: [
      { label: 'Yes, and I got an answer', w: 0 },
      { label: 'Yes, but it was not really answered', w: 1 },
      { label: 'No', w: 2 },
    ] },

  /* ---- something changed ------------------------------------------------ */
  { id: 'gen-change', kind: 'screen', tracks: ['prepare'],
    domain: 'A change you cannot explain',
    q: 'Has something changed in your health that you cannot explain?',
    a: [
      { label: 'Not really', w: 0 },
      { label: 'Maybe, it is hard to say', w: 1 },
      { label: 'Yes', w: 2, opens: ['gen-when'] },
    ] },

  { id: 'gen-long', kind: 'screen', tracks: ['prepare', 'cycle', 'pain'],
    domain: 'How long this has gone on',
    q: 'How long have you been noticing it?',
    a: [
      { label: 'Under a year', w: 0 },
      { label: 'One to three years', w: 1 },
      { label: 'More than three years', w: 2 },
    ] },

  { id: 'gen-effect', kind: 'screen', tracks: ['prepare', 'cycle'],
    domain: 'The effect on your life',
    q: 'Has it changed your work, study or plans?',
    a: [
      { label: 'No', w: 0 },
      { label: 'Occasionally I have had to change something', w: 1 },
      { label: 'Regularly, and I plan around it', w: 2 },
    ] },

  { id: 'gen-raised', kind: 'screen',
    tracks: ['prepare', 'cycle', 'pain', 'sleep', 'labs', 'treatment'],
    domain: 'What you have been told before',
    q: 'Have you raised this with a clinician before?',
    a: [
      { label: 'No, not yet', w: 0 },
      { label: 'Yes, and I am still working it out with them', w: 1 },
      { label: 'Yes, and I was told it was normal or nothing was found', w: 2 },
    ] },

  { id: 'gen-when', kind: 'follow', tracks: [],
    domain: 'When it started',
    q: 'Do you know roughly when it started?',
    a: [
      { label: 'Yes, I could give you a date', w: 0 },
      { label: 'A rough month', w: 1 },
      { label: 'No', w: 2 },
    ] },
];

const BY_ID = new Map(BANK.map((q) => [q.id, q]));

export const get = (id: string) => BY_ID.get(id);

/* -------------------------------------------------------------------------
   THE ENGINE
   ------------------------------------------------------------------------- */

/** Answered, in the order asked. */
export type Given = { id: string; w: Weight };

/** At most this many questions, whatever happens. Twelve was the old fixed
    length and it was too many for most people; nine is the ceiling and
    almost nobody reaches it. */
export const CAP = 9;

/** Below this, the result is too thin to be worth taking anywhere. */
const FLOOR = 4;

/** How many opening screeners may come back at zero before we stop. */
const QUIET = 4;

type Plan = { opened: string[]; closed: Set<string> };

function plan(given: Given[]): Plan {
  const opened: string[] = [];
  const closed = new Set<string>();

  /* Strongest first: everything a "2" opened, then everything a "1" did. An
     answer at the top of the scale is the strongest signal in the session,
     so what it asks for goes to the front of the queue. */
  for (const w of [2, 1] as const) {
    for (const g of given) {
      if (g.w !== w) continue;
      const q = get(g.id);
      const chosen = q?.a.find((x) => x.w === g.w);
      for (const id of chosen?.opens ?? []) if (!opened.includes(id)) opened.push(id);
    }
  }
  for (const g of given) {
    const chosen = get(g.id)?.a.find((x) => x.w === g.w);
    for (const id of chosen?.closes ?? []) closed.add(id);
  }
  return { opened, closed };
}

/**
 * The next question, or null when the quiz is done.
 *
 * Pure: the same track and the same answers always produce the same
 * question, which is what makes this checkable rather than magic.
 */
export function next(track: Track, given: Given[]): Question | null {
  if (given.length >= CAP) return null;

  const asked = new Set(given.map((g) => g.id));
  const { opened, closed } = plan(given);

  const free = (id: string) => !asked.has(id) && !closed.has(id);

  // 1 · anything a strong answer asked for.
  for (const id of opened) {
    if (free(id)) return get(id) ?? null;
  }

  // 2 · nothing outstanding, and the opening questions were all quiet:
  //     stop rather than work through the rest to reach the same place.
  if (given.length >= FLOOR) {
    const quiet = given.slice(0, QUIET).every((g) => g.w === 0);
    if (quiet && opened.every((id) => !free(id))) return null;
  }

  // 3 · the next screener for this track: its own questions first, in bank
  //     order, then the ones it borrows from other tracks.
  for (const own of [true, false]) {
    for (const q of BANK) {
      if (q.kind !== 'screen' || !q.tracks.includes(track)) continue;
      if ((q.tracks[0] === track) !== own) continue;
      if (free(q.id)) return q;
    }
  }

  return null;
}

/** How far along, for the bar. An estimate, and it says so by moving. */
export function progress(track: Track, given: Given[]): number {
  const screeners = BANK.filter((q) => q.kind === 'screen' && q.tracks.includes(track)).length;
  const { opened } = plan(given);
  const expected = Math.min(CAP, Math.max(FLOOR, Math.min(screeners, 6) + opened.length));
  return Math.min(1, given.length / expected);
}

/** The result: her own answers, sorted. Nothing scored, nothing named. */
export function result(given: Given[]) {
  const domain = (id: string) => get(id)?.domain ?? '';
  return {
    first: given.filter((g) => g.w === 2).map((g) => domain(g.id)).filter(Boolean),
    also: given.filter((g) => g.w === 1).map((g) => domain(g.id)).filter(Boolean),
  };
}
