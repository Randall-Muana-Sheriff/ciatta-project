// What her hospitals actually sent.
//
// Until now records arrived in clinical_records and no screen read them,
// which is the worst shape a feature can be in: the data is real, the
// interface says nothing, and she has no way to know whether connecting
// did anything at all.
//
// Everything shown here came from a provider. Nothing on this screen is
// computed, compared or characterised, and the two rules from
// clinicalView hold all the way to the pixels:
//
//   A result the lab did not flag shows no flag. There is no "in range"
//   on this screen and no colour that means it.
//
//   A retracted result is not drawn. It is counted at the foot, so a
//   chart that looks shorter than she remembers has an explanation.

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { type Connection, disconnectProvider, loadClinicalRecords, loadConnections, syncProviders } from '../data/providers';
import { connectionLine, needsReconnect, providerName, syncNote } from '../lib/providers/connectionView';
import { displayCopy } from '../lib/displayCopy';
import {
  type ChartView,
  chartLine,
  chartView,
  dayLabel,
  flagLabel,
  isEmpty,
  statusNote,
} from '../lib/providers/clinicalView';
import type { ClinicalRecord } from '../lib/providers/fhirMap';
import { type Screen, useNav } from '../navigation';
import { font, GUTTER } from '../theme';
import { Eyebrow } from '../ui/bento';
import { DetailScreen, SecondaryButton, Lead } from '../ui/kit';
import { HUE, L, NAV_CLEARANCE, SPACE, TILE_RADIUS } from '../ui/surface';
import { CardFill } from '../ui/cardFill';
import { G } from '../ui/scheme';

const FLAG_HUE: Record<string, string> = {
  High: HUE.escalation,
  Low: HUE.measured,
  Flagged: HUE.attention,
};

export function ChartScreen() {
  const nav = useNav();
  const [view, setView] = useState<ChartView | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const read = useCallback(async () => {
    setBusy(true);
    try {
      const [records, conns] = await Promise.all([loadClinicalRecords(), loadConnections()]);
      setView(chartView(records));
      setConnections(conns);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void read();
  }, [read]);

  // Pulling down asks her providers for anything new, then reads again.
  const refresh = useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      setNote(syncNote(await syncProviders(connections)));
    } finally {
      await read();
    }
  }, [connections, read]);

  const add = useCallback(() => nav.push('providerConnect' as Screen), [nav]);

  const remove = useCallback(
    (c: Connection) => {
      Alert.alert(
        displayCopy(`Remove ${providerName(c)}?`),
        'The records it sent are removed from Ciatta. Nothing changes in your chart at your provider, and you can connect again later.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () =>
              void disconnectProvider(c.id).then((ok) => {
                if (!ok) setNote('That provider could not be removed just now. Nothing was changed.');
                return read();
              }),
          },
        ],
      );
    },
    [read],
  );

  const providers = connections.length ? (
    <Providers connections={connections} onReconnect={add} onRemove={remove} onAdd={add} />
  ) : null;

  if (!view) {
    return (
      <DetailScreen title="From your providers" onBack={nav.back}>
        <View style={s.centre}>
          <ActivityIndicator color={G.meta} />
        </View>
      </DetailScreen>
    );
  }

  if (isEmpty(view)) {
    return (
      <DetailScreen title="From your providers" onBack={nav.back}>
        <ScrollView
          style={s.fill}
          contentContainerStyle={s.body}
          refreshControl={<RefreshControl refreshing={busy} onRefresh={refresh} tintColor={G.meta} />}
        >
          <Lead
            style={s.lede}
            text={
              connections.length
                ? 'Nothing has arrived from your providers yet. Pull down to check again.'
                : 'Nothing has arrived from a provider yet. Connecting a hospital or clinic brings your results, conditions and medications here.'
            }
          />
          {note ? <Text style={[font('caption1'), s.note]}>{displayCopy(note)}</Text> : null}
          {providers ?? (
            <View style={[s.pad, { marginTop: SPACE.block }]}>
              <SecondaryButton label="Connect a Provider" onPress={add} />
            </View>
          )}
        </ScrollView>
      </DetailScreen>
    );
  }

  return (
    <DetailScreen title="From your providers" onBack={nav.back}>
      <ScrollView
        style={s.fill}
        contentContainerStyle={s.body}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={refresh} tintColor={G.meta} />}
      >
        <Lead style={s.lede} text={displayCopy(chartLine(view))} />
        <Text style={[font('caption1'), s.note]}>
          Everything here came from your provider, in their words. Ciatta has not changed any of it.
        </Text>
        {note ? <Text style={[font('caption1'), s.note]}>{displayCopy(note)}</Text> : null}
        {providers}

        <Standing title="Conditions" records={view.conditions} />
        <Standing title="Medications" records={view.medications} />
        <Standing title="Allergies" records={view.allergies} />

        {view.days.length ? (
          <View style={s.section}>
            <Eyebrow>Labs</Eyebrow>
            {view.days.map((day) => (
              <View key={day.on ?? 'undated'} style={s.day}>
                <Text style={[font('footnote', 'semibold'), s.dayHead]}>{dayLabel(day.on)}</Text>
                <View style={s.card}>
                  <CardFill />
                  {day.results.map((r, n) => (
                    <Result key={r.sourceId} record={r} first={n === 0} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <Standing title="Immunisations" records={view.immunizations} />
        <Standing title="Procedures" records={view.procedures} />
        <Standing title="Reports and Imaging" records={view.reports} />
        <Standing title="Clinical Notes" records={view.notes} />
        <Standing title="Visits" records={view.visits} />
        <Standing title="Appointments" records={view.appointments} />
        <Standing title="Devices and Implants" records={view.devices} />
        <Standing title="Family History" records={view.familyHistory} />
        <Standing title="Goals" records={view.goals} />
        <Standing title="Care Plans" records={view.carePlans} />
        <Standing title="Coverage" records={view.coverage} />

        {view.retracted > 0 ? (
          <Text style={[font('caption1'), s.note]}>
            {view.retracted === 1
              ? 'Your provider withdrew 1 record, so it is not shown.'
              : `Your provider withdrew ${view.retracted} records, so they are not shown.`}
          </Text>
        ) : null}
      </ScrollView>
    </DetailScreen>
  );
}

// Her providers, each with what it has sent and when, and the two things
// she can do: connect again when it has expired, and remove it.
function Providers({
  connections,
  onReconnect,
  onRemove,
  onAdd,
}: {
  connections: readonly Connection[];
  onReconnect: () => void;
  onRemove: (c: Connection) => void;
  onAdd: () => void;
}) {
  const now = new Date();
  return (
    <View style={s.section}>
      <Eyebrow>Your providers</Eyebrow>
      <View style={s.card}>
        <CardFill />
        {connections.map((c, n) => (
          <View key={c.id} style={[s.provider, n > 0 && s.divided]}>
            <Text style={[font('subhead', 'semibold'), s.name]}>{displayCopy(providerName(c))}</Text>
            <Text style={[font('caption1'), needsReconnect(c) ? s.attention : s.when]}>{displayCopy(connectionLine(c, now))}</Text>
            <View style={s.providerActions}>
              {needsReconnect(c) ? <TextAction label="Connect again" onPress={onReconnect} /> : null}
              <TextAction label="Remove" onPress={() => onRemove(c)} />
            </View>
          </View>
        ))}
      </View>
      <View style={{ marginTop: SPACE.near }}>
        <SecondaryButton label="Add Another Provider" onPress={onAdd} />
      </View>
    </View>
  );
}

function TextAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} style={({ pressed }) => pressed && s.pressed}>
      <Text style={[font('footnote', 'semibold'), s.action]}>{label}</Text>
    </Pressable>
  );
}

function Standing({ title, records }: { title: string; records: readonly ClinicalRecord[] }) {
  if (!records.length) return null;
  return (
    <View style={s.section}>
      <Eyebrow>{title}</Eyebrow>
      <View style={s.card}>
        <CardFill />
        {records.map((r, n) => (
          <View key={r.sourceId} style={[s.row, n > 0 && s.divided]}>
            <View style={{ flex: 1 }}>
              <Text style={[font('subhead'), s.name]}>{displayCopy(r.name)}</Text>
              {r.effectiveOn ? <Text style={[font('caption2'), s.when]}>{dayLabel(r.effectiveOn)}</Text> : null}
            </View>
            {r.value ? <Text style={[font('subhead'), s.value]}>{displayCopy(r.value)}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function Result({ record, first }: { record: ClinicalRecord; first: boolean }) {
  const flag = flagLabel(record);
  const status = statusNote(record);
  return (
    <View
      style={[s.row, !first && s.divided]}
      accessible
      accessibilityLabel={[record.name, record.value ?? 'no value given', flag, status].filter(Boolean).join(', ')}
    >
      <View style={{ flex: 1 }}>
        <Text style={[font('subhead'), s.name]}>{displayCopy(record.name)}</Text>
        {status ? <Text style={[font('caption2'), s.status]}>{status}</Text> : null}
      </View>
      {/*
        A flag only when the lab sent one. There is deliberately no else
        here: an unflagged result shows its value and nothing beside it.
      */}
      {flag ? (
        <Text style={[font('caption1', 'semibold'), { color: FLAG_HUE[flag] ?? G.meta }]}>{flag}</Text>
      ) : null}
      <Text style={[font('subhead', 'semibold'), s.value]}>
        {record.value ? displayCopy(record.value) : 'No value given'}
      </Text>
    </View>
  );
}

const st = StyleSheet.hairlineWidth;

const s = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingBottom: NAV_CLEARANCE },
  pad: { paddingHorizontal: GUTTER },
  centre: { paddingVertical: SPACE.section, alignItems: 'center' },
  lede: { color: G.ink, lineHeight: 24, paddingHorizontal: GUTTER },
  note: { color: G.meta, lineHeight: 18, marginTop: 8, paddingHorizontal: GUTTER },

  section: { marginTop: SPACE.block, paddingHorizontal: GUTTER },
  day: { marginTop: SPACE.near },
  dayHead: { color: G.body, marginBottom: 6 },

  card: {
    marginTop: SPACE.tight,
    backgroundColor: L.glass,
    borderRadius: TILE_RADIUS,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  divided: { borderTopWidth: st, borderTopColor: G.rule },
  name: { color: L.ink },
  when: { color: L.meta, marginTop: 2 },
  status: { color: HUE.uncertainty, marginTop: 2 },
  value: { color: L.body },
  provider: { paddingVertical: 12, gap: 2 },
  providerActions: { flexDirection: 'row', gap: 18, marginTop: 6 },
  action: { color: L.ink },
  attention: { color: HUE.attention, marginTop: 2 },
  pressed: { opacity: 0.6 },
});
