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
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { loadClinicalRecords } from '../data/providers';
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

const FLAG_HUE: Record<string, string> = {
  High: HUE.escalation,
  Low: HUE.measured,
  Flagged: HUE.attention,
};

export function ChartScreen() {
  const nav = useNav();
  const [view, setView] = useState<ChartView | null>(null);
  const [busy, setBusy] = useState(false);

  const read = useCallback(async () => {
    setBusy(true);
    try {
      setView(chartView(await loadClinicalRecords()));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void read();
  }, [read]);

  if (!view) {
    return (
      <DetailScreen title="From your providers" onBack={nav.back}>
        <View style={s.centre}>
          <ActivityIndicator color={L.meta} />
        </View>
      </DetailScreen>
    );
  }

  if (isEmpty(view)) {
    return (
      <DetailScreen title="From your providers" onBack={nav.back}>
        <View style={s.pad}>
          <Lead style={s.lede} text={"Nothing has arrived from a provider yet. Connecting a hospital or clinic brings your results, conditions and medications here."} />
          <View style={{ marginTop: SPACE.block }}>
            <SecondaryButton label="Connect a Provider" onPress={() => nav.push('providerConnect' as Screen)} />
          </View>
        </View>
      </DetailScreen>
    );
  }

  return (
    <DetailScreen title="From your providers" onBack={nav.back}>
      <ScrollView
        style={s.fill}
        contentContainerStyle={s.body}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={read} tintColor={L.meta} />}
      >
        <Lead style={s.lede} text={displayCopy(chartLine(view))} />
        <Text style={[font('caption1'), s.note]}>
          Everything here came from your provider, in their words. Ciatta has not changed any of it.
        </Text>

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
        <Text style={[font('caption1', 'semibold'), { color: FLAG_HUE[flag] ?? L.meta }]}>{flag}</Text>
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
  lede: { color: L.ink, lineHeight: 24, paddingHorizontal: GUTTER },
  note: { color: L.meta, lineHeight: 18, marginTop: 8, paddingHorizontal: GUTTER },

  section: { marginTop: SPACE.block, paddingHorizontal: GUTTER },
  day: { marginTop: SPACE.near },
  dayHead: { color: L.body, marginBottom: 6 },

  card: {
    marginTop: SPACE.tight,
    backgroundColor: L.glass,
    borderRadius: TILE_RADIUS,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  divided: { borderTopWidth: st, borderTopColor: L.rule },
  name: { color: L.ink },
  when: { color: L.meta, marginTop: 2 },
  status: { color: HUE.uncertainty, marginTop: 2 },
  value: { color: L.body },
});
