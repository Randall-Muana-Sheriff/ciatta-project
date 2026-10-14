// Her record as a month.
//
// The one view where absence is as legible as presence. Three blank weeks
// before a flare is a fact about her life, and no other screen in the app
// shows it: they all draw what arrived.
//
// Everything that decides anything is in lib/calendarMonth and is tested.
// The marks are three, kept apart on purpose, because what she bled, what
// she wrote down and what a device recorded are three different kinds of
// knowing and a single dot would blur them.

import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import {
  canGoForward,
  type DayMark,
  dayLine,
  hasMarks,
  iso,
  monthGrid,
  monthSummary,
  stepMonth,
  WEEKDAYS,
} from '../lib/calendarMonth';
import { eventsOnDay, isCareVisit, timeOf, upcomingVisits, visitWhen } from '../lib/calendarEvents';
import { displayCopy } from '../lib/displayCopy';
import { useNav } from '../navigation';
import { useCycle, useCycleInsights } from '../state/cycleStore';
import { useData } from '../state/session';
import { font, GUTTER } from '../theme';
import { Icon } from '../ui/icons';
import { ListGroup, ListRow } from '../ui/chrome';
import { DetailScreen, SecondaryButton } from '../ui/kit';
import { addAppointmentWithForm, useDeviceCalendar } from '../state/deviceCalendar';
import { HUE, L, NAV_CLEARANCE, SPACE, TILE_RADIUS } from '../ui/surface';
import { GlassFill } from '../ui/frosted';

export function CalendarScreen() {
  const nav = useNav();
  const { days } = useData();
  const { episodes } = useCycle();
  const { windows } = useCycleInsights();
  const { width } = useWindowDimensions();

  const now = useMemo(() => new Date(), []);
  const [at, setAt] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [picked, setPicked] = useState<DayMark | null>(null);

  // Days she bled, from periods she logged. Nothing predicted: a calendar
  // quietly shading next month would be claiming something no one
  // established.
  const periodDays = useMemo(() => {
    const out = new Set<string>();
    for (const w of windows) {
      const end = w.end ?? w.start;
      for (let d = new Date(w.start); d <= end; d.setDate(d.getDate() + 1)) out.add(iso(d));
    }
    return out;
  }, [windows]);

  const loggedDays = useMemo(() => new Set(episodes.map((e) => e.date)), [episodes]);

  // A day counts as measured when something actually arrived for it, not
  // merely because a row exists.
  const measuredDays = useMemo(
    () =>
      new Set(
        days
          .filter((d) => d.sleepHours != null || d.steps != null || d.hrv != null || d.restingHR != null)
          .map((d) => d.date),
      ),
    [days],
  );

  // Her calendar, from this phone: the month on screen, and the next two
  // months for what is coming up. Read only, and only once she allowed it.
  const range = useMemo(() => {
    const from = new Date(at.year, at.month, 1 - 7);
    const monthEnd = new Date(at.year, at.month + 1, 7);
    const ahead = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 61);
    return { from, to: monthEnd > ahead ? monthEnd : ahead };
  }, [at, now]);
  const cal = useDeviceCalendar(range.from, range.to);
  const visitDays = useMemo(() => new Set(cal.events.filter(isCareVisit).map((e) => iso(e.start))), [cal.events]);
  const coming = useMemo(() => upcomingVisits(cal.events, now, 60), [cal.events, now]);
  const [addNote, setAddNote] = useState<string | null>(null);
  const add = async () => {
    const r = await addAppointmentWithForm();
    setAddNote(r === 'unavailable' ? 'Your calendar could not be opened on this device.' : null);
    if (r === 'saved') await cal.reload();
  };

  const grid = useMemo(
    () => monthGrid({ year: at.year, month: at.month, periodDays, loggedDays, measuredDays, now }),
    [at, periodDays, loggedDays, measuredDays, now],
  );

  const step = useCallback((by: 1 | -1) => {
    setPicked(null);
    setAt((prev) => stepMonth(prev.year, prev.month, by));
  }, []);

  const forward = canGoForward(at.year, at.month, now);
  // Square cells, sized from the width that is left after the gutters.
  const cell = Math.floor((width - GUTTER * 2 - 12) / 7);

  return (
    <DetailScreen title="Calendar" onBack={nav.back}>
      <View style={s.head}>
        <Pressable
          onPress={() => step(-1)}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          hitSlop={10}
          style={({ pressed }) => [s.arrow, pressed && s.pressed]}
        >
          <Icon name="chevronLeft" size={18} color={L.body} />
        </Pressable>
        <Text style={[font('headline'), s.month]} accessibilityRole="header">
          {grid.label}
        </Text>
        {/*
          Forward stops at this month. The record ends today, so a next
          month is a page of blanks and an arrow that leads to one is an
          arrow that lies about there being something there.
        */}
        <Pressable
          onPress={() => forward && step(1)}
          disabled={!forward}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityState={{ disabled: !forward }}
          hitSlop={10}
          style={({ pressed }) => [s.arrow, pressed && s.pressed]}
        >
          <Icon name="chevronRight" size={18} color={forward ? L.body : L.rule} />
        </Pressable>
      </View>

      <Text style={[font('caption1'), s.summary]}>{displayCopy(monthSummary(grid))}</Text>

      <View style={s.weekdays}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={[font('caption2'), s.weekday, { width: cell }]}>
            {d}
          </Text>
        ))}
      </View>

      <View style={s.grid}>
        {grid.weeks.map((week, w) => (
          <View key={w} style={s.week}>
            {week.map((d) => (
              <Cell key={d.date} mark={d} visit={visitDays.has(d.date)} size={cell} selected={picked?.date === d.date} onPress={() => setPicked(d)} />
            ))}
          </View>
        ))}
      </View>

      {/* What the marks mean, because three dots with no legend is a puzzle. */}
      <View style={s.legend}>
        <Key colour={HUE.reported} label="You logged bleeding" />
        <Key colour={HUE.change} label="You logged an experience" />
        <Key colour={HUE.measured} label="Something was measured" />
        {cal.access === 'granted' ? <Key colour={HUE.timeDepth} label="A care visit in your calendar" /> : null}
      </View>

      {picked ? (
        <View style={s.detail}>
          <GlassFill />
          <Text style={[font('footnote', 'semibold'), s.detailDay]}>{displayCopy(longDay(picked.date))}</Text>
          <Text style={[font('body'), s.detailLine]}>{displayCopy(dayLine(picked))}</Text>
          {eventsOnDay(cal.events, picked.date).map((e) => (
            <View key={e.id} style={s.event}>
              <View style={[s.dot, { backgroundColor: isCareVisit(e) ? HUE.timeDepth : L.meta }]} />
              <Text style={[font('subhead'), s.eventText]} numberOfLines={2}>
                {displayCopy(`${e.allDay ? 'All day' : timeOf(e.start)}  ${e.title}`)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/*
        Her calendar. One permission covers every calendar on this phone,
        Google and Outlook accounts included, and nothing read here leaves
        the device.
      */}
      <View style={s.section}>
        <Text style={[font('headline'), s.sectionTitle]} accessibilityRole="header">
          Your Calendar
        </Text>
        {cal.access === 'granted' ? (
          <>
            <Text style={[font('footnote'), s.sectionSub]}>Care visits coming up in the next two months, from the calendars on this iPhone.</Text>
            {coming.length ? (
              <ListGroup light style={{ marginTop: 10 }}>
                {coming.map((e, n) => (
                  <ListRow
                    light
                    key={e.id}
                    first={n === 0}
                    icon="calendarPlus"
                    title={displayCopy(e.title)}
                    sub={displayCopy([visitWhen(e, now), e.location].filter(Boolean).join(' · ') + '. Tap to prepare.')}
                    onPress={() => nav.push('appointment')}
                  />
                ))}
              </ListGroup>
            ) : (
              <Text style={[font('subhead'), s.none]}>No care visits found in the next two months.</Text>
            )}
            <View style={{ marginTop: 12 }}>
              <SecondaryButton label="Add an Appointment" onPress={() => void add()} />
            </View>
            {addNote ? <Text style={[font('footnote'), s.sectionSub]}>{addNote}</Text> : null}
          </>
        ) : cal.access === 'unavailable' ? (
          <Text style={[font('footnote'), s.sectionSub]}>Your calendar is available on iPhone.</Text>
        ) : (
          <>
            <Text style={[font('footnote'), s.sectionSub]}>
              See your events beside your days, and get ready for care visits coming up. Works with iCloud, Google and Outlook calendars on this iPhone. Your events stay on this device.
            </Text>
            <View style={{ marginTop: 12 }}>
              {cal.access === 'denied' ? (
                <SecondaryButton label="Allow in Settings" onPress={() => void Linking.openSettings()} />
              ) : (
                <SecondaryButton label="Connect Your Calendar" onPress={() => void cal.connect()} />
              )}
            </View>
          </>
        )}
      </View>

      <View style={{ height: NAV_CLEARANCE }} />
    </DetailScreen>
  );
}

function Cell({
  mark,
  visit,
  size,
  selected,
  onPress,
}: {
  mark: DayMark;
  visit: boolean;
  size: number;
  selected: boolean;
  onPress: () => void;
}) {
  // Days outside the month are drawn faintly rather than left blank, so
  // the grid keeps its shape and she can see where the month begins.
  const dim = mark.outside || mark.future;
  return (
    <Pressable
      onPress={onPress}
      disabled={mark.outside}
      accessibilityRole="button"
      accessibilityLabel={`${mark.day}, ${dayLine(mark)}${visit ? ', a care visit in your calendar' : ''}`}
      style={[s.cell, { width: size, height: size }, selected && s.cellOn]}
    >
      <Text style={[font('subhead'), dim ? s.dim : mark.today ? s.todayText : s.dayText]}>{mark.day}</Text>
      <View style={s.dots}>
        {mark.period ? <View style={[s.dot, { backgroundColor: HUE.reported }]} /> : null}
        {mark.logged ? <View style={[s.dot, { backgroundColor: HUE.change }]} /> : null}
        {mark.measured ? <View style={[s.dot, { backgroundColor: HUE.measured }]} /> : null}
        {visit ? <View style={[s.dot, { backgroundColor: HUE.timeDepth }]} /> : null}
        {/* Nothing recorded draws nothing. Not a grey dot meaning fine. */}
        {!hasMarks(mark) && !visit ? <View style={s.dotNone} /> : null}
      </View>
      {mark.today ? <View style={s.todayRing} /> : null}
    </Pressable>
  );
}

function Key({ colour, label }: { colour: string; label: string }) {
  return (
    <View style={s.key}>
      <View style={[s.dot, { backgroundColor: colour }]} />
      <Text style={[font('caption1'), s.keyText]}>{label}</Text>
    </View>
  );
}

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function longDay(isoDay: string): string {
  const [y, m, d] = isoDay.split('-').map(Number);
  return `${d} ${MONTHS_LONG[m - 1]} ${y}`;
}

const st = StyleSheet.hairlineWidth;

const s = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
  },
  arrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  month: { color: L.ink },
  summary: { color: L.meta, paddingHorizontal: GUTTER, marginTop: 4 },

  weekdays: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: GUTTER, marginTop: SPACE.near },
  weekday: { color: L.meta, textAlign: 'center' },

  grid: { paddingHorizontal: GUTTER, marginTop: 6 },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  cell: { alignItems: 'center', justifyContent: 'center', borderRadius: 12, gap: 3 },
  cellOn: { backgroundColor: L.fillSelected, borderWidth: st, borderColor: L.edgeOn },
  dayText: { color: L.body },
  todayText: { color: L.ink },
  dim: { color: L.rule },
  todayRing: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderRadius: 11,
    borderWidth: st,
    borderColor: L.meta,
  },

  dots: { flexDirection: 'row', gap: 2, height: 5, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  dotNone: { width: 5, height: 5 },

  legend: { marginTop: SPACE.block, paddingHorizontal: GUTTER, gap: 8 },
  key: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  keyText: { color: L.meta },

  detail: {
    marginTop: SPACE.block,
    marginHorizontal: GUTTER,
    backgroundColor: L.glass,
    borderRadius: TILE_RADIUS,
    borderWidth: st,
    borderColor: L.rule,
    padding: 16,
    overflow: 'hidden',
  },
  detailDay: { color: L.meta },
  detailLine: { color: L.ink, lineHeight: 24, marginTop: 4 },
  event: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  eventText: { color: L.body, flex: 1 },
  section: { marginTop: SPACE.section, paddingHorizontal: GUTTER },
  sectionTitle: { color: L.ink },
  sectionSub: { color: L.meta, marginTop: 4, lineHeight: 18 },
  none: { color: L.body, marginTop: 10 },
  pressed: { opacity: 0.55 },
});
