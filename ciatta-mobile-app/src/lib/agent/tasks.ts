// What the agent carries out when she asks: a visit prep summary with the
// questions worth asking, and a lab decoding brief. Both are built by code
// from her record (the context in proactive.ts) and are hers to take or
// send; neither is sent anywhere by Ciatta, and neither diagnoses.

import { isOutside, labDay, labHistory, type LabResult, labStatus } from '../labs';
import { currentStep } from '../referrals';
import { type AgentContext, bpBand, bpLine, spo2Line, stoolLean } from './proactive';

export type PrepSection = { title: string; lines: string[] };
export type VisitPrep = { sections: PrepSection[]; questions: string[] };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (day: string) => {
  const [, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const valueOf = (l: LabResult) => (l.value != null ? `${l.value}${l.unit ? ` ${l.unit}` : ''}` : (l.valueText ?? ''));

// The latest result of each test.
function latestByTest(labs: readonly LabResult[]): LabResult[] {
  const m = new Map<string, LabResult>();
  for (const l of labs) {
    const k = l.name.toLowerCase();
    if (!m.has(k) || m.get(k)!.on < l.on) m.set(k, l);
  }
  return [...m.values()].sort((a, b) => b.on.localeCompare(a.on));
}

export function visitPrep(c: AgentContext, _now: Date): VisitPrep {
  const readings = c.readings.filter((r) => r.daysOutside >= 3 && (r.side === 'above' || r.side === 'below'));
  const symptoms = c.symptoms.filter((s) => s.versus?.startsWith('More often'));
  const labs = latestByTest(c.labs).filter(isOutside);
  const missed = c.meds.month.find((m) => m.label === 'Missed a dose')?.days ?? 0;
  const referrals = c.referrals.filter((r) => currentStep(r));
  const bp = c.vitals.bp && bpBand(c.vitals.bp) !== 'usual' ? c.vitals.bp : null;
  const spo2 = c.vitals.spo2 && c.vitals.spo2.value < 95 ? c.vitals.spo2 : null;
  const blood = c.gut?.blood ?? 0;
  const lean = c.gut ? stoolLean(c.gut) : null;
  const times = (n: number) => `${n} ${n === 1 ? 'occasion' : 'occasions'}`;

  const sections: PrepSection[] = [
    {
      title: 'This visit',
      lines: [
        ...(c.visit ? [[c.visit.title, lower(c.visit.when), c.visit.location].filter(Boolean).join(', ')] : []),
        ...(c.cycle ? [`Cycle day ${c.cycle.day}${c.cycle.phase ? `, ${lower(c.cycle.phase)}` : ''}`] : []),
      ],
    },
    {
      title: 'What changed',
      lines: [
        ...(bp ? [bpLine(bp)] : []),
        ...(spo2 ? [spo2Line(spo2)] : []),
        ...(blood ? [`Blood with a bowel movement on ${times(blood)} in the last 4 weeks`] : []),
        ...(lean ? [`Most logged bowel movements ${lean} in the last 4 weeks (Bristol ${lean === 'loose' ? 'types 5 to 7' : 'types 1 and 2'})`] : []),
        ...readings.map((r) => `${r.label} ${r.side} my usual for ${r.daysOutside} days, latest ${r.latest} against ${r.usual}`),
        ...symptoms.map((s) => `${s.name} on ${s.days} days in the last 90, more often lately${s.worst != null ? `, worst ${s.worst} of 10` : ''}`),
      ],
    },
    {
      title: 'Labs outside range',
      lines: labs.map((l) => `${l.name} ${labStatus(l).label.toLowerCase()}, ${valueOf(l)} on ${short(l.on)}${l.rangeText ? ` (lab range ${l.rangeText})` : ''}`),
    },
    {
      title: 'What I take',
      lines: [
        ...c.meds.medications.map((m) => `${m.name} (medication)`),
        ...c.meds.supplements.map((m) => `${m.name} (supplement)`),
        ...(missed ? [`Missed a dose on ${missed} ${missed === 1 ? 'day' : 'days'} in the last 30`] : []),
      ],
    },
    {
      title: 'Referrals',
      lines: referrals.map((r) => `${r.specialty}: next, ${currentStep(r)!.label.toLowerCase()}`),
    },
  ].filter((s) => s.lines.length);

  const questions = [
    ...(bp ? [`My blood pressure was ${bp.systolic}/${bp.diastolic} on ${short(bp.on)}. Is that worth checking, and how often should I measure it?`] : []),
    ...(spo2 ? [`My watch read my blood oxygen at ${spo2.value}% on ${short(spo2.on)}. Is that something to look into?`] : []),
    ...(blood ? [`I saw blood with a bowel movement on ${times(blood)} in the last 4 weeks. What should we look at?`] : []),
    ...(lean ? [`Most of my bowel movements lately have been ${lean}. What could be behind that?`] : []),
    ...readings.map((r) => `My ${lower(r.label)} has been ${r.side} my usual for ${r.daysOutside} days. Is that worth looking into?`),
    ...symptoms.map((s) => `I have had ${lower(s.name)} on ${s.days} days in the last 90, more often lately. What could be behind it?`),
    ...labs.map(
      (l) => `My ${lower(l.name)} was ${labStatus(l).label.toLowerCase()} (${valueOf(l)}) on ${short(l.on)}. What could explain that, and should it be rechecked?`,
    ),
    ...(missed ? [`I missed my medication on ${missed} ${missed === 1 ? 'day' : 'days'} this month. Is there a time or form that would be easier?`] : []),
    ...referrals.map((r) => `Where does my referral to ${r.specialty} stand, and is there anything I need to do?`),
  ];
  return { sections, questions };
}

export type LabBrief = {
  title: string;
  rows: { label: string; value: string; note?: string }[];
  trend: string | null;
  questions: string[];
  note: string;
};

export function labBrief(labs: readonly LabResult[], name: string): LabBrief | null {
  const history = labHistory(labs, name);
  const latest = history[history.length - 1];
  if (!latest) return null;
  const status = labStatus(latest);
  const prev = [...history].reverse().find((l) => l !== latest && l.value != null);

  let trend: string | null = null;
  if (prev && latest.value != null) {
    const word = latest.value < prev.value! ? 'Lower than' : latest.value > prev.value! ? 'Higher than' : 'The same as';
    trend = `${word} your previous result, ${valueOf(prev)} on ${labDay(prev.on)}.`;
  }

  const questions =
    status.key === 'noRange'
      ? ['What does this result mean for me?', 'Is it something to check again?']
      : status.key === 'inRange'
        ? ['Is this result what you would expect for me?', 'When should it be checked again?']
        : [
            `What could explain a ${status.label.toLowerCase()} ${lower(latest.name)} for me?`,
            'Should it be rechecked, and when?',
            'Is there anything I should do, or avoid, before the next test?',
          ];

  return {
    title: latest.name,
    rows: [
      { label: 'Latest', value: valueOf(latest), note: labDay(latest.on) },
      { label: 'Status', value: status.label, ...(status.basis ? { note: status.basis } : {}) },
      ...(latest.rangeText ? [{ label: 'Lab range', value: latest.rangeText }] : []),
      { label: 'Results on record', value: String(history.length) },
    ],
    trend,
    questions,
    note: 'This brief puts your result beside the range your lab printed. It is not a diagnosis: what a result means for you is a question for your clinician.',
  };
}

// ── As pages she can share or print ────────────────────────────

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const day = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

const PAGE_STYLE = `<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111; margin: 36px; font-size: 12px; line-height: 1.5; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #555; margin: 0 0 18px; }
  h2 { font-size: 14px; margin: 20px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 5px 0; border-bottom: 1px solid #f0f0f0; }
  .v { font-weight: 600; }
  .n { color: #666; margin-left: 8px; font-weight: normal; }
  footer { margin-top: 26px; color: #666; font-size: 10.5px; }
</style>`;

export function visitPrepHtml(prep: VisitPrep, meta: { name: string | null; made: Date }): string {
  const sections = prep.sections
    .map((s) => `<h2>${esc(s.title)}</h2><ul>${s.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`)
    .join('');
  const questions = prep.questions.length ? `<h2>Questions to ask</h2><ol>${prep.questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>` : '';
  return `<!doctype html><html><head><meta charset="utf-8">${PAGE_STYLE}</head><body>
  <h1>Visit prep${meta.name ? ` for ${esc(meta.name)}` : ''}</h1>
  <p class="meta">Made on ${esc(day(meta.made))} with Ciatta, from her own record.</p>
  ${sections}${questions}
  <footer>What she logged and what her devices and labs recorded, with the questions she chose. This is not a diagnosis.</footer>
</body></html>`;
}

export function labBriefHtml(b: LabBrief, meta: { made: Date }): string {
  return `<!doctype html><html><head><meta charset="utf-8">${PAGE_STYLE}</head><body>
  <h1>${esc(b.title)}</h1>
  <p class="meta">Lab brief, made on ${esc(day(meta.made))} with Ciatta.</p>
  <table>${b.rows.map((r) => `<tr><td>${esc(r.label)}</td><td class="v">${esc(r.value)}${r.note ? `<span class="n">${esc(r.note)}</span>` : ''}</td></tr>`).join('')}</table>
  ${b.trend ? `<p>${esc(b.trend)}</p>` : ''}
  <h2>Questions to ask</h2><ol>${b.questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>
  <footer>${esc(b.note)}</footer>
</body></html>`;
}
