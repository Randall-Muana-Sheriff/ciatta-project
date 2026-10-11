// Prepare for an appointment: build a brief from her record.
//
// The screen is a reading surface, not a form. Everything in the brief is
// already in her record, so there is nothing to fill in: the only decisions
// are how far back it reaches and whether she takes it.
//
// What the brief may say is decided in healthBrief.ts, which is pure and
// tested. This file renders what that returns and adds nothing to it, which
// is the point: a brief is read by a clinician in about ninety seconds, and
// a sentence invented at render time would be the hardest kind to catch.

import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import type { Reported } from '../data/repo';
import { briefHasAnything, briefRange, buildBrief, emptyLine, type BriefSection } from '../lib/healthBrief';
import { displayCopy } from '../lib/displayCopy';
import { fmtHours } from '../lib/engine';
import { useNav } from '../navigation';
import { useCycleInsights } from '../state/cycleStore';
import { useData, useRepo } from '../state/session';
import { font, GUTTER } from '../theme';
import { Eyebrow } from '../ui/bento';
import { DetailScreen, SecondaryButton } from '../ui/kit';
import { L, NAV_CLEARANCE, SPACE, TILE_RADIUS } from '../ui/surface';

const WINDOWS: { label: string; days: number }[] = [
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
  { label: '6 months', days: 182 },
];

export function AppointmentScreen() {
  const nav = useNav();
  const { days } = useData();
  const repo = useRepo();
  const [reported, setReported] = useState<Reported | null>(null);

  useEffect(() => {
    let ignore = false;
    repo
      .loadReported()
      .then((r) => {
        if (!ignore) setReported(r);
      })
      .catch(() => {
        // The section says it is empty rather than guessing at her history.
      });
    return () => {
      ignore = true;
    };
  }, [repo]);
  const { windows } = useCycleInsights();
  const [span, setSpan] = useState(WINDOWS[1]);

  const to = new Date();
  const from = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - span.days);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [span.days]);

  const sections = useMemo(() => {
    const inWindow = days.filter((d) => new Date(d.date) >= from);

    // Measured, each with the day it came from. Only the newest of each,
    // because a brief is a summary and a clinician reading forty step
    // counts learns less than one.
    const newest = [...inWindow].sort((a, b) => (a.date < b.date ? 1 : -1));
    const readings: { label: string; value: string; on: string }[] = [];
    const pick = (label: string, get: (d: (typeof newest)[number]) => number | null, say: (n: number) => string) => {
      const found = newest.find((d) => get(d) != null);
      if (found) readings.push({ label, value: say(get(found) as number), on: found.date });
    };
    pick('Sleep', (d) => d.sleepHours, fmtHours);
    pick('Resting heart rate', (d) => d.restingHR, (n) => `${Math.round(n)} bpm`);
    pick('Heart rate variability', (d) => d.hrv, (n) => `${Math.round(n)} ms`);

    // Her own words, newest first.
    const notes = inWindow
      .filter((d) => d.note)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((d) => ({ on: d.date, text: d.note as string }));

    return buildBrief({
      from,
      to,
      // Reported symptoms come from the profile's own list when there is
      // one. Nothing is counted that she did not log.
      symptoms: [],
      conditions: [...(reported?.conditions ?? []), ...(reported?.surgeries ?? [])],
      medications: [...(reported?.medications ?? []), ...(reported?.supplements ?? [])],
      readings,
      cycleLengths: windows.filter((w) => w.length != null).map((w) => w.length as number),
      tried: [],
      notes,
    });
    // to is a new Date each render and would retrigger forever; the window
    // is what actually decides the content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, from, reported, windows]);

  const anything = briefHasAnything(sections);

  const takeIt = async () => {
    const text = [
      `Ciatta health brief, ${briefRange(from, to)}`,
      '',
      ...sections.flatMap((s) => [
        s.title.toUpperCase(),
        ...(s.empty ? [emptyLine(s.id)] : s.lines.map((l) => (l.detail ? `${l.text}, ${l.detail}` : l.text))),
        '',
      ]),
    ].join('\n');
    try {
      await Share.share({ message: text });
    } catch {
      // Dismissed, or no share sheet. Nothing to recover from.
    }
  };

  return (
    <DetailScreen title="Prepare for an Appointment" onBack={nav.back}>
      <ScrollView style={s.fill} contentContainerStyle={s.body}>
        <Text style={[font('body'), s.lede]}>
          Everything here is already in your record. Ciatta gathers it so you are not remembering it in the room.
        </Text>

        <Eyebrow>How far back</Eyebrow>
        <View style={s.spans}>
          {WINDOWS.map((w) => {
            const on = w.days === span.days;
            return (
              <Text
                key={w.label}
                onPress={() => setSpan(w)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[font('subhead', on ? 'semibold' : 'regular'), s.span, on && s.spanOn]}
              >
                {w.label}
              </Text>
            );
          })}
        </View>
        <Text style={[font('caption1'), s.range]}>{briefRange(from, to)}</Text>

        {sections.map((section) => (
          <Section key={section.id} section={section} />
        ))}

        {/*
          Offered only when there is something in it. A brief of four empty
          sections is not a document to take to a doctor, and saying so is
          more use than letting her find out in the room.
        */}
        <View style={s.take}>
          {anything ? (
            <SecondaryButton label="Take it with you" onPress={takeIt} />
          ) : (
            <Text style={[font('subhead'), s.none]}>
              There is nothing in your record for this period yet. Log what you notice and it will gather here.
            </Text>
          )}
        </View>
      </ScrollView>
    </DetailScreen>
  );
}

function Section({ section }: { section: BriefSection }) {
  return (
    <View style={s.section}>
      <Text style={[font('headline'), s.title]}>{section.title}</Text>
      <Text style={[font('caption1'), s.what]}>{section.what}</Text>
      <View style={s.card}>
        {section.empty ? (
          <Text style={[font('subhead'), s.empty]}>{displayCopy(emptyLine(section.id))}</Text>
        ) : (
          section.lines.map((line, n) => (
            <View key={`${line.text}-${n}`} style={[s.line, n > 0 && s.lineDivided]}>
              <Text style={[font('subhead'), s.lineText]}>{displayCopy(line.text)}</Text>
              {line.detail ? <Text style={[font('caption1'), s.lineDetail]}>{displayCopy(line.detail)}</Text> : null}
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingHorizontal: GUTTER, paddingBottom: NAV_CLEARANCE },
  lede: { color: L.body, lineHeight: 24, marginBottom: SPACE.block },
  spans: { flexDirection: 'row', gap: 8, marginTop: 10 },
  span: {
    color: L.body,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: L.recessed,
    overflow: 'hidden',
  },
  spanOn: { color: L.canvas, backgroundColor: L.ink },
  range: { color: L.meta, marginTop: 8 },
  section: { marginTop: SPACE.block },
  title: { color: L.ink },
  what: { color: L.meta, marginTop: 2 },
  card: { marginTop: 10, backgroundColor: L.recessed, borderRadius: TILE_RADIUS, paddingHorizontal: 14 },
  line: { paddingVertical: 11 },
  lineDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: L.rule },
  lineText: { color: L.ink },
  lineDetail: { color: L.meta, marginTop: 2 },
  empty: { color: L.body, paddingVertical: 14, lineHeight: 21 },
  take: { marginTop: SPACE.section },
  none: { color: L.body, lineHeight: 21 },
});
