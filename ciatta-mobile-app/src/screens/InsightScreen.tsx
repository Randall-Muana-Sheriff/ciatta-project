import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { insight } from '../data/sample';
import { displayCopy } from '../lib/displayCopy';
import { useNav } from '../navigation';
import { C, caps, sans, serif } from '../theme';
import { InsightLineChart, Legend } from '../ui/charts';
import { Card, DetailScreen, Facts, LinkButton, PrimaryButton, Row, SecLabel, Tag } from '../ui/kit';

export function InsightScreen() {
  const nav = useNav();
  const [watching, setWatching] = useState(true);
  const [showMethod, setShowMethod] = useState(false);

  return (
    <DetailScreen title="Your health" onBack={nav.back}>
      <View style={i.between}>
        <Tag label="Personalized insight" tone="amber" upper />
        <Pressable
          onPress={() => setWatching((w) => !w)}
          accessibilityRole="switch"
          accessibilityState={{ checked: watching }}
          style={i.watch}
        >
          <Text style={[sans(13, 500), { color: watching ? C.secondary : C.text }]}>
            {watching ? 'Watching' : 'Watch'}
          </Text>
        </Pressable>
      </View>

      <Text style={[serif(28), { color: C.text, lineHeight: 32, marginBottom: 12 }]} accessibilityRole="header">
        {displayCopy(insight.headline)}
      </Text>

      <View style={i.meta}>
        <Tag label="Ciatta" tone="orange" />
        <Text style={[sans(12), { color: C.muted, flex: 1 }]}>{insight.meta}</Text>
      </View>

      <Card style={i.chartCard}>
        <Legend
          style={{ marginTop: 0, marginBottom: 10 }}
          items={[
            { label: 'Cycle length', color: C.blue },
            { label: 'Sleep', color: C.sleepLine },
          ]}
        />
        <InsightLineChart />
      </Card>

      <SecLabel right={`${insight.basedOn.length} sources`}>Based on</SecLabel>
      {insight.basedOn.map((r, n) => (
        <Row
          key={r.label}
          first={n === 0}
          title={r.label}
          sub={r.sub}
          value={r.value}
          valueColor={C.secondary}
          onPress={() => nav.push(r.screen)}
        />
      ))}

      <View style={i.evidence}>
        <Text style={[sans(11, 600), caps, { color: C.amber, marginBottom: 8 }]}>Relevant evidence</Text>
        <Text style={[sans(14), { color: C.secondary, marginBottom: 4 }]}>{insight.evidence.claim}</Text>
        <Text style={[sans(12), { color: C.muted }]}>{insight.evidence.meta}</Text>
      </View>

      <Text style={[sans(14), { color: C.secondary, marginBottom: 6 }]}>
        <Text style={[sans(14, 600), { color: C.text }]}>STILL OPEN </Text>
        {insight.stillOpen}
      </Text>
      <Text style={[sans(13), { color: C.muted, marginBottom: 20 }]}>
        Things that move together are not one causing the other.
      </Text>

      <PrimaryButton label="Prepare for your appointment" />
      <LinkButton
        center
        size={14}
        label={showMethod ? 'Hide how this was worked out' : 'See how this was worked out'}
        onPress={() => setShowMethod((v) => !v)}
      />
      {showMethod ? (
        <Card style={{ marginTop: 12 }}>
          <Facts rows={insight.method} />
        </Card>
      ) : null}
    </DetailScreen>
  );
}

const i = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  watch: { borderWidth: 1, borderColor: C.border, borderRadius: 100, paddingVertical: 5, paddingHorizontal: 14 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  chartCard: { paddingHorizontal: 12, paddingBottom: 12, marginBottom: 20 },
  evidence: {
    backgroundColor: C.amberBg,
    borderWidth: 1,
    borderColor: C.amberBorder,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 20,
    marginBottom: 16,
  },
});
