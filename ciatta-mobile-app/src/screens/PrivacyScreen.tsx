// Who can see her record, in plain words, from how the app actually works.
// The facts are in lib/privacyFacts.ts and are tested; this reads what is
// switched on for her so the page describes her, not every user.

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { loadConnections } from '../data/providers';
import { displayCopy } from '../lib/displayCopy';
import { type PrivacyFact, privacyFacts } from '../lib/privacyFacts';
import { useNav } from '../navigation';
import { weatherIsOn } from '../state/environmentRun';
import { useRepo } from '../state/session';
import { font } from '../theme';
import { DetailScreen, SecondaryButton } from '../ui/kit';
import { L, SPACE, TILE_RADIUS } from '../ui/surface';
import { CardFill } from '../ui/cardFill';

export function PrivacyScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [facts, setFacts] = useState<PrivacyFact[]>(() => privacyFacts({ sources: [], providers: [], weatherOn: false, findingsOn: false }));

  useEffect(() => {
    let ignore = false;
    Promise.all([
      repo.loadSources().catch(() => []),
      loadConnections().catch(() => []),
      weatherIsOn().catch(() => false),
      repo.loadNotifyFindings().catch(() => false),
    ]).then(([sources, providers, weatherOn, findingsOn]) => {
      if (ignore) return;
      setFacts(
        privacyFacts({
          // Only what is actually sending: a source she never finished
          // connecting is not one that can see anything.
          sources: sources.filter((s) => s.kind === 'measured' && /active|connected|synced/i.test(s.status)).map((s) => s.name),
          providers: providers.filter((p) => p.status !== 'revoked').map((p) => p.organization ?? p.endpointName),
          weatherOn,
          findingsOn,
        }),
      );
    });
    return () => {
      ignore = true;
    };
  }, [repo]);

  return (
    <DetailScreen title="Who Can See This" onBack={nav.back}>
      {facts.map((f) => (
        <View key={f.title} style={s.card}>
          <CardFill />
          <Text style={[font('headline'), s.title]}>{displayCopy(f.title)}</Text>
          <Text style={[font('subhead'), s.body]}>{displayCopy(f.body)}</Text>
        </View>
      ))}
      <View style={{ marginTop: SPACE.block, gap: 12 }}>
        <SecondaryButton label="Share with a Clinician" onPress={() => nav.push('shareClinician')} />
      </View>
    </DetailScreen>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: L.glass, borderRadius: TILE_RADIUS, padding: 16, marginTop: 12, overflow: 'hidden' },
  title: { color: L.ink, marginBottom: 6 },
  body: { color: L.body, lineHeight: 21 },
});
