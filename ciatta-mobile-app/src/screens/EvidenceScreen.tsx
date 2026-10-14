import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import type { Triage } from '../lib/engine';
import { metricLine, patternReadiness, readinessLine } from '../lib/patternReadiness';
import { useNav } from '../navigation';
import { useCycle } from '../state/cycleStore';
import { useInsights } from '../state/insights';
import { useData, useRepo } from '../state/session';
import { environmentLine } from '../lib/environmentContext';
import { C, font } from '../theme';
import { ListGroup, ListRow } from '../ui/chrome';
import { DetailScreen, SecondaryButton, SourceFooter, Tag } from '../ui/kit';
import { G } from '../ui/scheme';

const TRIAGE_LABEL: Record<Triage, string> = {
  Surface: 'On Today',
  Investigate: 'Worth looking into',
  Watch: 'Being watched',
  Recommend: 'Suggestion',
  Ignore: 'Not shown',
};

// What a pattern rests on, what it doesn't show, and what else could explain it.
export function EvidenceScreen() {
  const nav = useNav();
  const { focus, setFocus, watching, setWatching } = useCycle();
  const { ranked, today } = useInsights();
  const { days } = useData();
  const repo = useRepo();
  const [weather, setWeather] = useState<string | null>(null);
  useEffect(() => {
    repo
      .loadEnvironment()
      .then((env) => setWeather(environmentLine(env, new Date())))
      .catch(() => {});
  }, [repo]);
  const shown = ranked.filter((i) => i.triage !== 'Ignore');
  // Without a chosen pattern, open on the story Today leads with.
  const item = shown.find((i) => i.id === (focus ?? today.lead?.id)) ?? shown[0];

  if (!item) {
    // Why there is nothing yet, per measure, from her own rows. "Not
    // enough data" is true and tells her nothing about when it stops being
    // true; the engine's requirements are arithmetic, so this can say.
    const ready = patternReadiness(days);
    return (
      <DetailScreen title="Evidence" onBack={nav.back}>
        <Text style={[font('body'), { color: G.body }]}>No patterns have appeared yet.</Text>
        <Text style={[font('subhead'), e.brief]}>{displayCopy(readinessLine(days, ready))}</Text>
        {days.length ? (
          <ListGroup header="What Each Measure Has" style={e.section}>
            {ready.map((r, n) => (
              <ListRow key={r.key} first={n === 0} title={r.label} sub={displayCopy(metricLine(r))} />
            ))}
          </ListGroup>
        ) : null}
      </DetailScreen>
    );
  }

  const others = shown.filter((i) => i.id !== item.id);
  const on = watching[item.id] ?? true;

  return (
    <DetailScreen
      title="Evidence"
      onBack={nav.back}
      footer={<SourceFooter kind="logged" text="Built from your logs, your devices, and your records." />}
    >
      <Text style={[font('footnote', 'semibold'), { color: G.ink }]}>{TRIAGE_LABEL[item.triage]}</Text>
      <Text style={[font('title2', 'semibold'), { color: G.ink, marginTop: 2 }]} accessibilityRole="header">
        {displayCopy(item.title)}
      </Text>
      <Text style={[font('body'), e.brief]}>{displayCopy(item.brief)}</Text>
      <View style={e.tags}>
        {item.domains.map((d) => (
          <Tag key={d} label={d} tone="neutral" />
        ))}
      </View>

      <ListGroup header="What Supports This" style={e.section}>
        {item.evidence.supports.map((line, n) => (
          <ListRow key={line} first={n === 0} title={line} />
        ))}
      </ListGroup>

      <ListGroup header="What This Doesn’t Establish" style={e.section}>
        {item.evidence.notEstablished.map((line, n) => (
          <ListRow key={line} first={n === 0} title={line} />
        ))}
      </ListGroup>

      <ListGroup header="Other Explanations" style={e.section}>
        {item.evidence.alternatives.map((line, n) => (
          <ListRow key={line} first={n === 0} title={line} />
        ))}
        {/* The weather, only when it was unusual for her, and never as a
            cause: background a stretch happened against. */}
        {weather ? <ListRow title={displayCopy(weather)} sub="Weather from Apple Weather, air from Open-Meteo" /> : null}
      </ListGroup>

      <ListGroup
        style={e.section}
        footer={item.triage === 'Watch' ? 'This stays off Today until it has happened more often.' : undefined}
      >
        <ListRow
          first
          title="Keep watching this relationship"
          right={
            <Switch
              value={on}
              onValueChange={(v) => setWatching(item.id, v)}
              trackColor={{ false: C.fill, true: C.green }}
              ios_backgroundColor={C.fill}
              accessibilityLabel="Keep watching this relationship"
            />
          }
        />
      </ListGroup>

      <View style={e.section}>
        <SecondaryButton label="Prepare for an Appointment" onPress={() => nav.push('appointment')} />
      </View>

      {others.length ? (
        <ListGroup header="Also Being Watched" style={e.section}>
          {others.map((o, n) => (
            <ListRow key={o.id} first={n === 0} title={o.title} sub={TRIAGE_LABEL[o.triage]} onPress={() => setFocus(o.id)} />
          ))}
        </ListGroup>
      ) : null}
    </DetailScreen>
  );
}

const e = StyleSheet.create({
  brief: { color: G.ink, marginTop: 10, lineHeight: 25 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  section: { marginTop: 28 },
});
