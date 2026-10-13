// Her calendar, read on the phone: the events from every calendar iOS holds
// for her, which includes Google and Outlook accounts she added in
// Settings, so one permission covers Apple and Google alike with no
// separate sign in.
//
// Events never leave the device. Nothing here is saved to her record or
// sent anywhere: the calendar is read when a screen needs it and dropped.
//
// What Ciatta does with it is narrow: show a day's events beside what she
// logged and what was measured, and tell care visits from the rest by
// their words, so a visit coming up can be prepared for.

export type CalEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  location: string | null;
  notes: string | null;
  allDay: boolean;
};

// Words that mark a visit to care. Whole words only, so "Drinks" is not a
// doctor and "Labour Day" is not a lab.
const CARE = new RegExp(
  [
    'dr\\.?', 'doctor', 'gp', 'clinic', 'hospital', 'surgery', 'appointment', 'appt',
    'ob\\s?/?\\s?gyn', 'obgyn', 'gyn(a)?ecolog\\w*', 'obstetric\\w*', 'midwife', 'nurse',
    'dentist', 'dental', 'derm\\w*', 'endocrin\\w*', 'cardiolog\\w*', 'neurolog\\w*', 'rheumatolog\\w*',
    'urolog\\w*', 'gastro\\w*', 'physio\\w*', 'physiotherap\\w*', 'therapy', 'therapist', 'psychiatr\\w*', 'counsell?ing',
    'scan', 'ultrasound', 'mri', 'x\\s?ray', 'blood\\s?(test|work|draw)', 'labs?', 'pharmacy',
    'check\\s?up', 'smear', 'pap', 'mammogram', 'telehealth', 'consult\\w*', 'specialist', 'fertility', 'ivf',
  ]
    .map((w) => `\\b${w}(?![a-z])`)
    .join('|'),
  'i',
);

export function isCareVisit(e: CalEvent): boolean {
  return CARE.test(e.title) || (e.location != null && CARE.test(e.location));
}

// Care visits from now on, soonest first, within the next few days.
export function upcomingVisits(events: readonly CalEvent[], now: Date, withinDays = 30): CalEvent[] {
  const until = now.getTime() + withinDays * 86400000;
  return events
    .filter((e) => isCareVisit(e) && e.end.getTime() >= now.getTime() && e.start.getTime() <= until)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

// The events on one local day, all day ones first, then by start.
export function eventsOnDay(events: readonly CalEvent[], iso: string): CalEvent[] {
  const [y, m, d] = iso.split('-').map(Number);
  const from = new Date(y, m - 1, d).getTime();
  const to = new Date(y, m - 1, d + 1).getTime();
  return events
    .filter((e) => e.start.getTime() < to && e.end.getTime() > from)
    .sort((a, b) => (a.allDay === b.allDay ? a.start.getTime() - b.start.getTime() : a.allDay ? -1 : 1));
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function timeOf(d: Date): string {
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes();
  return `${h}${m ? `:${String(m).padStart(2, '0')}` : ''} ${d.getHours() < 12 ? 'am' : 'pm'}`;
}

// When a visit is, said plainly: Today, Tomorrow, or the date.
export function visitWhen(e: CalEvent, now: Date): string {
  const days = Math.round((dayStart(e.start) - dayStart(now)) / 86400000);
  const day =
    days === 0
      ? 'Today'
      : days === 1
        ? 'Tomorrow'
        : e.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return e.allDay ? day : `${day}, ${timeOf(e.start)}`;
}
