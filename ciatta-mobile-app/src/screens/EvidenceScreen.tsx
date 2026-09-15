import { StyleSheet, Switch, Text, View } from 'react-native';

import type { Triage } from '../lib/engine';
import { useNav } from '../navigation';
import { useCycle } from '../state/cycleStore';
import { useInsights } from '../state/insights';
import { C, font } from '../theme';
import { ListGroup, ListRow } from '../ui/chrome';
import { DetailScreen, SecondaryButton, SourceFooter, Tag } from '../ui/kit';

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
  const shown = ranked.filter((i) => i.triage !== 'Ignore');
  // Without a chosen pattern, open on the story Today leads with.
  const item = shown.find((i) => i.id === (focus ?? today.lead?.id)) ?? shown[0];

  if (!item) {
    return (
      <DetailScreen title="Evidence" onBack={nav.back}>
        <Text style={[font('body'), { color: C.secondary }]}>No patterns have appeared yet.</Text>
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
      <Text style={[font('footnote', 'semibold'), { color: C.tint }]}>{TRIAGE_LABEL[item.triage]}</Text>
      <Text style={[font('title2', 'semibold'), { color: C.text, marginTop: 2 }]} accessibilityRole="header">
        {item.title}
      </Text>
      <Text style={[font('body'), e.brief]}>{item.brief}</Text>
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
        <SecondaryButton label="Prepare for an Appointment" onPress={() => nav.push('healthrecords')} />
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
  brief: { color: C.text, marginTop: 10, lineHeight: 25 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  section: { marginTop: 28 },
});
