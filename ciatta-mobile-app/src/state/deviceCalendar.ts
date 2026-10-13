// The phone's calendar, through EventKit. Read only when she has allowed
// it, held in memory for the screen that asked, and never stored or sent.
// See lib/calendarEvents for what Ciatta does with what it reads.

import * as Calendar from 'expo-calendar';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import type { CalEvent } from '../lib/calendarEvents';

export type CalendarAccess = 'granted' | 'denied' | 'undetermined' | 'unavailable';

const toDate = (v: string | Date | null | undefined) => (v == null ? null : v instanceof Date ? v : new Date(v));

export async function calendarAccess(): Promise<CalendarAccess> {
  if (Platform.OS !== 'ios') return 'unavailable';
  try {
    const p = await Calendar.getCalendarPermissions();
    return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unavailable';
  }
}

export async function requestCalendarAccess(): Promise<CalendarAccess> {
  if (Platform.OS !== 'ios') return 'unavailable';
  try {
    const p = await Calendar.requestCalendarPermissions();
    return p.granted ? 'granted' : 'denied';
  } catch {
    return 'unavailable';
  }
}

export async function loadCalendarEvents(from: Date, to: Date): Promise<CalEvent[]> {
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  if (!calendars.length) return [];
  const events = await Calendar.listEvents(calendars, from, to);
  const out: CalEvent[] = [];
  for (const e of events) {
    const start = toDate(e.startDate);
    const end = toDate(e.endDate) ?? start;
    if (!start || !end) continue;
    out.push({
      id: e.id,
      title: e.title || 'Busy',
      start,
      end,
      location: e.location || null,
      notes: e.notes || null,
      allDay: !!e.allDay,
    });
  }
  return out;
}

// The system's own new event sheet, filled in. She picks the time and the
// calendar there, which works for Google and iCloud calendars alike, and
// needs no access to read anything.
export async function addAppointmentWithForm(): Promise<'saved' | 'canceled' | 'unavailable'> {
  if (Platform.OS !== 'ios') return 'unavailable';
  try {
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(9, 0, 0, 0);
    const result = await Calendar.getDefaultCalendarSync().addEventWithForm({
      title: 'Appointment',
      startDate: start,
      endDate: new Date(start.getTime() + 3600000),
      notes: 'Prepare a brief in Ciatta before you go.',
    });
    return result.action === 'saved' ? 'saved' : 'canceled';
  } catch {
    return 'unavailable';
  }
}

// Events for a range, once access is granted. It never asks by itself:
// connect() is the one place the permission prompt is raised, from a
// button she pressed.
export function useDeviceCalendar(from: Date, to: Date) {
  const [access, setAccess] = useState<CalendarAccess>('undetermined');
  const [events, setEvents] = useState<CalEvent[]>([]);
  const fromMs = from.getTime();
  const toMs = to.getTime();

  const reload = useCallback(async () => {
    const a = await calendarAccess();
    setAccess(a);
    if (a !== 'granted') return setEvents([]);
    setEvents(await loadCalendarEvents(new Date(fromMs), new Date(toMs)).catch(() => []));
  }, [fromMs, toMs]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const connect = useCallback(async () => {
    const a = await requestCalendarAccess();
    setAccess(a);
    if (a === 'granted') await reload();
  }, [reload]);

  return { access, events, connect, reload };
}
