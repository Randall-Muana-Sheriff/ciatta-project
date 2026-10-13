import assert from 'node:assert/strict';
import { test } from 'node:test';

import { type CalEvent, eventsOnDay, isCareVisit, upcomingVisits, visitWhen } from './calendarEvents';

const ev = (title: string, start: Date, over: Partial<CalEvent> = {}): CalEvent => ({
  id: title + start.toISOString(), title, start, end: new Date(start.getTime() + 3600000), location: null, notes: null, allDay: false, ...over,
});

test('a care visit is told from the rest of the calendar by its words', () => {
  const on = new Date(2026, 9, 14, 9);
  for (const t of ['Dr Patel', 'Dr. Okafor follow up', 'OB/GYN appointment', 'Gynaecology clinic', 'Dentist', 'Blood test', 'Ultrasound', 'Physio', 'GP', 'Mammogram', 'Telehealth with Dr Lee', 'Endocrinologist']) {
    assert.equal(isCareVisit(ev(t, on)), true, t);
  }
  for (const t of ['Drinks with Sam', 'Team standup', 'Labour Day', 'Dinner', 'Flight to Lagos', 'Gym']) {
    assert.equal(isCareVisit(ev(t, on)), false, t);
  }
  // The place can say it when the title does not.
  assert.equal(isCareVisit(ev('Checkup', on, { location: 'St Mary Hospital' })), true);
  assert.equal(isCareVisit(ev('Sam', on, { location: 'Riverside Clinic' })), true);
});

test('coming up: care visits ahead, soonest first, within the window', () => {
  const now = new Date(2026, 9, 13, 12);
  const events = [
    ev('Dentist', new Date(2026, 9, 20, 10)),
    ev('Dr Patel', new Date(2026, 9, 15, 9)),
    ev('Dinner', new Date(2026, 9, 14, 19)),
    ev('GP', new Date(2026, 9, 10, 9)), // past
    ev('Ultrasound', new Date(2026, 11, 30, 9)), // too far
  ];
  assert.deepEqual(upcomingVisits(events, now, 30).map((e) => e.title), ['Dr Patel', 'Dentist']);
  assert.deepEqual(upcomingVisits(events, now, 3).map((e) => e.title), ['Dr Patel']);
});

test('a day\'s events, including ones that run across it', () => {
  const events = [
    ev('Morning', new Date(2026, 9, 14, 8)),
    ev('Trip', new Date(2026, 9, 13, 9), { end: new Date(2026, 9, 16, 9), allDay: true }),
    ev('Other day', new Date(2026, 9, 15, 8)),
  ];
  assert.deepEqual(eventsOnDay(events, '2026-10-14').map((e) => e.title), ['Trip', 'Morning']);
});

test('when a visit is, said plainly', () => {
  const now = new Date(2026, 9, 13, 12);
  assert.equal(visitWhen(ev('a', new Date(2026, 9, 13, 14, 30)), now), 'Today, 2:30 pm');
  assert.equal(visitWhen(ev('a', new Date(2026, 9, 14, 9)), now), 'Tomorrow, 9 am');
  assert.equal(visitWhen(ev('a', new Date(2026, 9, 16, 15)), now), 'Fri, Oct 16, 3 pm');
  assert.equal(visitWhen(ev('a', new Date(2026, 9, 16), { allDay: true }), now), 'Fri, Oct 16');
});
